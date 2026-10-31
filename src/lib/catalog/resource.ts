/** What every catalog resource (product, plan, tax, discount, template) offers the API layer. */
export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Resource<T> {
  list(url: URL): Promise<ListResult<T>>;
  get(id: number): Promise<T>;
  create(input: unknown): Promise<T>;
  update(id: number, input: unknown): Promise<T>;
  /** Soft-deactivates where history depends on the row; hard-deletes where nothing does. */
  remove(id: number): Promise<{ id: number; active?: boolean; deleted?: boolean }>;
}
