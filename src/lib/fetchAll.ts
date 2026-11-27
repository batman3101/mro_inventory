// The Supabase Data API returns at most 1,000 rows per request, silently
// dropping the rest (production outbound already has 5,000+ rows). This pages
// through with .range() until a short page comes back.
// The query must have a deterministic order (end with a unique column) or
// rows can be skipped or repeated between pages.
const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function fetchAllRows<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  let rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows = rows.concat(data ?? []);
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
