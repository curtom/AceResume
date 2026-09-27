import { defineStore } from 'pinia';
import {
  ResumeDocumentSchema,
  ResumeSectionSchema,
  type ResumeDocument,
  type ResumeSection,
  type ResumeTheme,
} from '@aceresume/resume-schema';
import type { ResumeDetail } from '@aceresume/contracts';
import * as resumeApi from '@/api/resume';
import { getApiErrorCode, getApiErrorMessage } from '@/api/http';
import {
  deleteResumeDraft,
  readResumeDraft,
  writeResumeDraft,
  type ResumeDraft,
} from '@/modules/resume/draft-storage';

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed' | 'conflict';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const useResumeEditorStore = defineStore('resume-editor', {
  state: () => ({
    detail: null as ResumeDetail | null,
    document: null as ResumeDocument | null,
    selectedSectionId: null as string | null,
    saveStatus: 'idle' as SaveStatus,
    errorMessage: null as string | null,
    isLoading: false,
    undoStack: [] as ResumeDocument[],
    redoStack: [] as ResumeDocument[],
    pendingDraft: null as ResumeDraft | null,
    conflictServer: null as ResumeDetail | null,
    saveTimer: null as ReturnType<typeof setTimeout> | null,
  }),
  getters: {
    isDirty: (state) => ['dirty', 'saving', 'failed', 'conflict'].includes(state.saveStatus),
    selectedSection(state): ResumeSection | null {
      return (
        state.document?.sections.find((section) => section.id === state.selectedSectionId) ?? null
      );
    },
  },
  actions: {
    applyServerDetail(detail: ResumeDetail): void {
      this.detail = detail;
      this.document = clone(detail.document);
      this.saveStatus = 'saved';
      this.undoStack = [];
      this.redoStack = [];
      this.pendingDraft = null;
      this.conflictServer = null;
      void deleteResumeDraft(detail.id);
    },
    async load(id: string): Promise<void> {
      this.isLoading = true;
      this.errorMessage = null;
      try {
        this.detail = await resumeApi.getResume(id);
        this.document = clone(this.detail.document);
        this.saveStatus = 'saved';
        this.undoStack = [];
        this.redoStack = [];
        this.selectedSectionId = this.document.sections[0]?.id ?? null;
        this.saveStatus = 'saved';
        this.undoStack = [];
        this.redoStack = [];
        const draft = await readResumeDraft(id);
        if (draft && JSON.stringify(draft.document) !== JSON.stringify(this.document))
          this.pendingDraft = draft;
      } catch (error: unknown) {
        this.errorMessage = getApiErrorMessage(error);
      } finally {
        this.isLoading = false;
      }
    },
    mutate(change: (document: ResumeDocument) => void): void {
      if (!this.document || !this.detail) return;
      const previous = clone(this.document);
      const next = clone(this.document);
      change(next);
      this.document = ResumeDocumentSchema.parse(next);
      this.undoStack.push(previous);
      if (this.undoStack.length > 50) this.undoStack.shift();
      this.redoStack = [];
      this.markDirty();
    },
    updateSection(section: ResumeSection): void {
      this.mutate((document) => {
        const index = document.sections.findIndex((item) => item.id === section.id);
        if (index >= 0) document.sections[index] = ResumeSectionSchema.parse(section);
      });
    },
    moveSection(sectionId: string, direction: -1 | 1): void {
      this.mutate((document) => {
        const index = document.sections.findIndex((section) => section.id === sectionId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= document.sections.length) return;
        const [section] = document.sections.splice(index, 1);
        if (section) document.sections.splice(target, 0, section);
        document.sections.forEach((item, sortOrder) => {
          item.sortOrder = sortOrder;
        });
      });
    },
    reorderSections(from: number, to: number): void {
      if (from === to) return;
      this.mutate((document) => {
        const [section] = document.sections.splice(from, 1);
        if (section) document.sections.splice(to, 0, section);
        document.sections.forEach((item, sortOrder) => {
          item.sortOrder = sortOrder;
        });
      });
    },
    removeCustomSection(sectionId: string): void {
      this.mutate((document) => {
        const index = document.sections.findIndex(
          (section) => section.id === sectionId && section.type === 'custom',
        );
        if (index >= 0) document.sections.splice(index, 1);
        document.sections.forEach((item, sortOrder) => {
          item.sortOrder = sortOrder;
        });
      });
      this.selectedSectionId = this.document?.sections[0]?.id ?? null;
    },
    addCustomSection(): void {
      if (!this.document) return;
      const section = ResumeSectionSchema.parse({
        id: crypto.randomUUID(),
        type: 'custom',
        title: '自定义模块',
        sortOrder: this.document.sections.length,
        isVisible: true,
        schemaVersion: 1,
        content: { body: { type: 'doc', content: [{ type: 'paragraph' }] } },
      });
      this.mutate((document) => document.sections.push(section));
      this.selectedSectionId = section.id;
    },
    updateTheme(theme: ResumeTheme): void {
      this.mutate((document) => {
        document.theme = theme;
      });
    },
    changeTemplate(templateVersionId: string): void {
      this.mutate((document) => {
        document.templateVersionId = templateVersionId;
      });
    },
    undo(): void {
      if (!this.document) return;
      const previous = this.undoStack.pop();
      if (!previous) return;
      this.redoStack.push(clone(this.document));
      this.document = previous;
      this.markDirty();
    },
    redo(): void {
      if (!this.document) return;
      const next = this.redoStack.pop();
      if (!next) return;
      this.undoStack.push(clone(this.document));
      this.document = next;
      this.markDirty();
    },
    markDirty(): void {
      if (!this.document || !this.detail) return;
      this.saveStatus = 'dirty';
      void writeResumeDraft({
        resumeId: this.detail.id,
        baseVersion: this.detail.version,
        document: clone(this.document),
        updatedAt: new Date().toISOString(),
      });
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => void this.saveNow(), 2_000);
    },
    async saveNow(): Promise<void> {
      if (
        !this.document ||
        !this.detail ||
        this.saveStatus === 'saving' ||
        this.saveStatus === 'conflict'
      )
        return;
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.saveStatus = 'saving';
      try {
        const saved = await resumeApi.saveResume(this.detail.id, {
          baseVersion: this.detail.version,
          idempotencyKey: crypto.randomUUID(),
          document: this.document,
        });
        this.detail = saved;
        this.document = clone(saved.document);
        this.saveStatus = 'saved';
        await deleteResumeDraft(saved.id);
      } catch (error: unknown) {
        if (getApiErrorCode(error) === 'RESUME_VERSION_CONFLICT') {
          this.conflictServer = await resumeApi.getResume(this.detail.id);
          this.saveStatus = 'conflict';
        } else {
          this.saveStatus = 'failed';
          this.errorMessage = getApiErrorMessage(error);
        }
      }
    },
    async restorePendingDraft(): Promise<void> {
      if (!this.pendingDraft || !this.detail) return;
      this.document = clone(this.pendingDraft.document);
      this.pendingDraft = null;
      this.markDirty();
    },
    async discardPendingDraft(): Promise<void> {
      if (!this.detail) return;
      this.pendingDraft = null;
      await deleteResumeDraft(this.detail.id);
    },
    keepLocalAfterConflict(): void {
      if (!this.detail || !this.conflictServer) return;
      this.detail = { ...this.detail, version: this.conflictServer.version };
      this.conflictServer = null;
      this.saveStatus = 'dirty';
      this.markDirty();
    },
    async useServerAfterConflict(): Promise<void> {
      if (!this.conflictServer) return;
      this.detail = this.conflictServer;
      this.document = clone(this.conflictServer.document);
      this.conflictServer = null;
      this.saveStatus = 'saved';
      await deleteResumeDraft(this.detail.id);
    },
    reset(): void {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.$reset();
    },
  },
});
