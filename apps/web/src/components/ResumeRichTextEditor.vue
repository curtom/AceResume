<script setup lang="ts">
import { watch } from 'vue';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { RichTextDocumentSchema, type RichTextDocument } from '@aceresume/resume-schema';

const props = defineProps<{ modelValue: RichTextDocument }>();
const emit = defineEmits<{ 'update:modelValue': [value: RichTextDocument] }>();
function toEditorContent(document: RichTextDocument): JSONContent {
  return JSON.parse(JSON.stringify(document)) as JSONContent;
}
const editor = useEditor({
  content: toEditorContent(props.modelValue),
  extensions: [
    StarterKit.configure({
      blockquote: false,
      code: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      strike: false,
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      protocols: ['http', 'https', 'mailto'],
      validate: (href) => /^(https?:|mailto:)/i.test(href),
    }),
  ],
  onUpdate: ({ editor: instance }) => {
    const parsed = RichTextDocumentSchema.safeParse(instance.getJSON());
    if (parsed.success) emit('update:modelValue', parsed.data);
  },
});
watch(
  () => props.modelValue,
  (value) => {
    if (editor.value && JSON.stringify(editor.value.getJSON()) !== JSON.stringify(value))
      editor.value.commands.setContent(toEditorContent(value), { emitUpdate: false });
  },
);
function setLink(): void {
  if (!editor.value) return;
  const current = String(editor.value.getAttributes('link').href ?? '');
  const href = globalThis.prompt('输入 http、https 或 mailto 链接', current);
  if (href === null) return;
  if (!href) editor.value.chain().focus().unsetLink().run();
  else if (/^(https?:|mailto:)/i.test(href))
    editor.value.chain().focus().extendMarkRange('link').setLink({ href }).run();
}
</script>

<template>
  <div class="rich-editor">
    <div v-if="editor" class="rich-toolbar">
      <button
        type="button"
        :class="{ active: editor.isActive('bold') }"
        @click="editor.chain().focus().toggleBold().run()"
      >
        B
      </button>
      <button
        type="button"
        :class="{ active: editor.isActive('italic') }"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <i>I</i>
      </button>
      <button
        type="button"
        :class="{ active: editor.isActive('underline') }"
        @click="editor.chain().focus().toggleUnderline().run()"
      >
        <u>U</u>
      </button>
      <button
        type="button"
        :class="{ active: editor.isActive('bulletList') }"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        • 列表
      </button>
      <button
        type="button"
        :class="{ active: editor.isActive('orderedList') }"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        1. 列表
      </button>
      <button type="button" :class="{ active: editor.isActive('link') }" @click="setLink">
        链接
      </button>
    </div>
    <EditorContent v-if="editor" :editor="editor" />
  </div>
</template>

<style scoped>
.rich-editor {
  border: 1px solid #d7dde5;
  border-radius: 6px;
  background: #fff;
}
.rich-toolbar {
  display: flex;
  gap: 0.25rem;
  padding: 0.4rem;
  border-bottom: 1px solid #e5e8ed;
}
.rich-toolbar button {
  border: 0;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  background: transparent;
  color: #516076;
}
.rich-toolbar button:hover,
.rich-toolbar button.active {
  color: #173fbd;
  background: #edf2ff;
}
:deep(.tiptap) {
  min-height: 6rem;
  padding: 0.7rem 0.85rem;
  outline: none;
}
:deep(.tiptap p) {
  margin: 0 0 0.4rem;
}
</style>
