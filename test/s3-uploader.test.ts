import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { S3Uploader, createUploader } from "../src/utils/s3-uploader";
import { S3Config } from "../types";
import path from "path";
import { ensureDir } from "../src/utils/file-utils";

// Use a temporary directory for test images
const TEST_IMAGES_DIR = path.join(import.meta.dir, "test-images");

describe("S3Uploader", () => {
  it("should initialize with config", () => {
    const config: S3Config = {
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      bucket: "test-bucket",
      publicUrl: "https://test-bucket.example.com",
      endpoint: "https://s3.example.com",
      region: "us-east-1",
    };

    const uploader = new S3Uploader(config);
    expect(uploader).toBeDefined();
  });

  describe("Directory Structure Preservation", () => {
    beforeAll(async () => {
      // Create test image directory structure with nested subdirectories
      await ensureDir(
        path.join(TEST_IMAGES_DIR, "2023/fish-tacos-at-el-pescadito-roma"),
      );
      await ensureDir(path.join(TEST_IMAGES_DIR, "2025/travel-guides"));

      // Create test image files
      const jpgContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes

      await Bun.write(
        path.join(
          TEST_IMAGES_DIR,
          "2023/fish-tacos-at-el-pescadito-roma/img-2680-1024x768.jpg",
        ),
        jpgContent,
      );
      await Bun.write(
        path.join(
          TEST_IMAGES_DIR,
          "2023/fish-tacos-at-el-pescadito-roma/img-2681-1024x576.jpg",
        ),
        jpgContent,
      );
      await Bun.write(
        path.join(TEST_IMAGES_DIR, "2025/travel-guides/singapore-1.jpg"),
        jpgContent,
      );
      await Bun.write(path.join(TEST_IMAGES_DIR, "root-image.jpg"), jpgContent);
    });

    afterAll(async () => {
      // Clean up test directory
      try {
        await Bun.file(TEST_IMAGES_DIR).rm?.({ recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should preserve directory structure when uploading images", async () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        publicUrl: "https://test-bucket.example.com",
        endpoint: "https://s3.example.com",
        region: "us-east-1",
      };

      // Set dry run mode to avoid actual S3 uploads
      process.env.BUNKI_DRY_RUN = "true";

      const uploader = new S3Uploader(config);
      const result = await uploader.uploadImages(TEST_IMAGES_DIR);

      // Get result keys for verification
      const keys = Object.keys(result);
      const nestedImageKey =
        "2023/fish-tacos-at-el-pescadito-roma/img-2680-1024x768.jpg";
      const nestedImage2Key =
        "2023/fish-tacos-at-el-pescadito-roma/img-2681-1024x576.jpg";
      const travelGuideKey = "2025/travel-guides/singapore-1.jpg";
      const rootKey = "root-image.jpg";

      // Verify all keys are present
      expect(keys).toContain(nestedImageKey);
      expect(keys).toContain(nestedImage2Key);
      expect(keys).toContain(travelGuideKey);
      expect(keys).toContain(rootKey);

      // Verify URLs contain the full path
      const url1 = result[nestedImageKey];
      expect(url1).toBeDefined();
      expect(url1).toContain(nestedImageKey);

      const url2 = result[travelGuideKey];
      expect(url2).toBeDefined();
      expect(url2).toContain(travelGuideKey);

      const url3 = result[rootKey];
      expect(url3).toBeDefined();
      expect(url3).toContain(rootKey);

      // Clean up
      delete process.env.BUNKI_DRY_RUN;
    });

    it("should find all images including those in nested directories", async () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        publicUrl: "https://test-bucket.example.com",
        endpoint: "https://s3.example.com",
        region: "us-east-1",
      };

      process.env.BUNKI_DRY_RUN = "true";

      const uploader = new S3Uploader(config);
      const result = await uploader.uploadImages(TEST_IMAGES_DIR);

      // Should have found all 4 images
      expect(Object.keys(result).length).toBe(4);

      // Verify all expected files are present
      const keys = Object.keys(result);
      expect(keys).toContain(
        "2023/fish-tacos-at-el-pescadito-roma/img-2680-1024x768.jpg",
      );
      expect(keys).toContain(
        "2023/fish-tacos-at-el-pescadito-roma/img-2681-1024x576.jpg",
      );
      expect(keys).toContain("2025/travel-guides/singapore-1.jpg");
      expect(keys).toContain("root-image.jpg");

      delete process.env.BUNKI_DRY_RUN;
    });
  });

  it("should handle createUploader function", async () => {
    const config: S3Config = {
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      bucket: "test-bucket",
      publicUrl: "https://test-bucket.example.com",
      endpoint: "https://s3.example.com",
      region: "us-east-1",
    };

    const uploader = createUploader(config);
    expect(uploader).toBeDefined();
  });
});
