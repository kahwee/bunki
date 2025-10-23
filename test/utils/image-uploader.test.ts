import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { uploadImages } from "../../src/utils/image-uploader";
import path from "path";
import { ensureDir } from "../../src/utils/file-utils";

describe("Image Uploader", () => {
  describe("uploadImages function", () => {
    const testBaseDir = path.join(import.meta.dir, "test-image-uploader");
    const imagesDir = path.join(testBaseDir, "images");
    const configFile = path.join(testBaseDir, "bunki.config.ts");

    beforeAll(async () => {
      // Create test directory structure
      await ensureDir(path.join(imagesDir, "2023/travel"));
      await ensureDir(path.join(imagesDir, "2024/food"));

      // Create test image files
      const jpgContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      await Bun.write(
        path.join(imagesDir, "2023/travel/paris.jpg"),
        jpgContent,
      );
      await Bun.write(path.join(imagesDir, "2024/food/pizza.jpg"), jpgContent);

      // Create a minimal bunki.config.ts for testing
      const configContent = `export const bunki = {
  s3: {
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    bucket: "test-bucket",
    publicUrl: "https://test-bucket.example.com",
    region: "us-east-1",
  },
};`;
      await Bun.write(configFile, configContent);
    });

    afterAll(async () => {
      try {
        await Bun.file(testBaseDir).rm?.({ recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    test("should upload images with default options", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      const result = await uploadImages({
        images: imagesDir,
      });

      // Should upload both images
      expect(Object.keys(result).length).toBeGreaterThan(0);

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should filter images by minYear when specified", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      const result = await uploadImages({
        images: imagesDir,
        minYear: 2024,
      });

      // Should only upload 2024 images
      const keys = Object.keys(result);
      const hasOldYears = keys.some((k) => k.includes("2023"));
      expect(hasOldYears).toBe(false);

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should create images directory if it doesn't exist", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      const nonExistentDir = path.join(testBaseDir, "non-existent-images");

      const result = await uploadImages({
        images: nonExistentDir,
      });

      // Should return empty map for non-existent directory
      expect(result).toEqual({});

      delete process.env.BUNKI_DRY_RUN;

      // Clean up
      try {
        await Bun.file(nonExistentDir).rm?.({ recursive: true });
      } catch {}
    });

    test("should output JSON mapping when requested", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      const outputFile = path.join(testBaseDir, "image-urls.json");
      const result = await uploadImages({
        images: imagesDir,
        outputJson: outputFile,
      });

      // Verify output file was created with valid JSON
      const file = await Bun.file(outputFile);
      const exists = await file.exists();
      expect(exists).toBe(true);

      if (exists) {
        const jsonData = JSON.parse(await file.text());
        expect(jsonData).toBeDefined();
        expect(Object.keys(jsonData).length).toBeGreaterThan(0);
      }

      delete process.env.BUNKI_DRY_RUN;
      try {
        await Bun.file(outputFile).rm?.({ recursive: true });
      } catch {}
    });

    test("should support domain option", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      const result = await uploadImages({
        images: imagesDir,
        domain: "test-domain",
      });

      expect(result).toBeDefined();
      expect(Object.keys(result).length).toBeGreaterThan(0);

      delete process.env.BUNKI_DRY_RUN;
    });
  });

  describe("Directory handling", () => {
    const dirTestBase = path.join(import.meta.dir, "test-dir-handling");

    afterAll(async () => {
      try {
        await Bun.file(dirTestBase).rm?.({ recursive: true });
      } catch {}
    });

    test("should handle empty images directory", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      const emptyDir = path.join(dirTestBase, "empty");
      await ensureDir(emptyDir);

      const result = await uploadImages({
        images: emptyDir,
      });

      expect(result).toEqual({});

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should handle deeply nested directory structures", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      const nestedDir = path.join(
        dirTestBase,
        "nested/2023/category/subcategory",
      );
      await ensureDir(nestedDir);

      const jpgContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      await Bun.write(path.join(nestedDir, "image.jpg"), jpgContent);

      const parentDir = path.join(dirTestBase, "nested");
      const result = await uploadImages({
        images: parentDir,
      });

      // Should find the deeply nested image
      const hasNestedImage = Object.keys(result).some((k) =>
        k.includes("subcategory"),
      );
      expect(hasNestedImage).toBe(true);

      delete process.env.BUNKI_DRY_RUN;
    });
  });

  describe("Error handling", () => {
    test("should throw error with invalid JSON output path", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      const testDir = path.join(import.meta.dir, "test-invalid-json-path");
      await ensureDir(testDir);

      let errorCaught = false;
      try {
        await uploadImages({
          images: testDir,
          outputJson: "/invalid/path/output.json",
        });
      } catch {
        errorCaught = true;
      }

      expect(errorCaught).toBe(true);
      delete process.env.BUNKI_DRY_RUN;

      try {
        await Bun.file(testDir).rm?.({ recursive: true });
      } catch {}
    });
  });
});
