import { TemplateId, TemplateDataMap, TemplateResult } from '../ui/templates';

export type AdapterResult<T extends TemplateId = TemplateId> = TemplateResult<T>;

export interface Adapter {
  id: string;
  priority?: number;
  match: (url: URL, doc: Document) => boolean;
  extract: (url: URL, doc: Document) => AdapterResult | null;
}
