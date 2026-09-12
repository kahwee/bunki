/** Map filesystem work with bounded concurrency, preserving input order. */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  transform: (item: T, index: number) => Promise<R>,
  concurrency = 16,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("Concurrency must be a positive integer");
  }
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (!failed && next < items.length) {
        const index = next++;
        try {
          results[index] = await transform(items[index], index);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }),
  );
  for (const worker of workers) {
    if (worker.status === "rejected") throw worker.reason;
  }
  return results;
}
