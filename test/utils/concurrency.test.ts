import { expect, test } from "bun:test";
import { mapConcurrent } from "../../src/utils/concurrency";

test("bounds active work and preserves input order", async () => {
  let active = 0;
  let maximum = 0;
  const results = await mapConcurrent(
    [3, 1, 2, 0],
    async (value) => {
      maximum = Math.max(maximum, ++active);
      await Bun.sleep(value);
      active--;
      return value * 2;
    },
    2,
  );
  expect(maximum).toBe(2);
  expect(results).toEqual([6, 2, 4, 0]);
});

test("drains running work before rejecting and stops scheduling after failure", async () => {
  const completed: number[] = [];
  await expect(
    mapConcurrent(
      [0, 1, 2, 3],
      async (value) => {
        if (value === 0) throw new Error("failed");
        await Bun.sleep(1);
        completed.push(value);
      },
      2,
    ),
  ).rejects.toThrow("failed");
  expect(completed).toEqual([1]);
  expect(await mapConcurrent([], async () => 0)).toEqual([]);
  await expect(mapConcurrent([1], async () => 0, 0)).rejects.toThrow("Concurrency");
});
