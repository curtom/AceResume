export interface ObjectStorageAdapter {
  isAvailable(): Promise<boolean>;
}
