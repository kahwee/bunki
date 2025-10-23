import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { S3Uploader, createUploader } from "../../src/utils/s3-uploader";
import { S3Config } from "../../src/types";
import path from "path";
import { ensureDir } from "../../src/utils/file-utils";

// Use a temporary directory for test images
const TEST_IMAGES_DIR = path.join(import.meta.dir, "test-images");

describe("S3Uploader", () => {
  test("should initialize with config", () => {
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

    test("should preserve directory structure when uploading images", async () => {
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

    test("should find all images including those in nested directories", async () => {
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

  test("should handle createUploader function", async () => {
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

  describe("Upload Method", () => {
    const testUploadDir = path.join(import.meta.dir, "test-upload-src");

    beforeAll(async () => {
      await ensureDir(testUploadDir);
      // Create some test files to upload
      await Bun.write(path.join(testUploadDir, "index.html"), "<h1>Test</h1>");
      await Bun.write(path.join(testUploadDir, "style.css"), "body { color: red; }");
    });

    afterAll(async () => {
      try {
        await Bun.file(testUploadDir).rm?.({ recursive: true });
      } catch {}
    });

    test("should upload site with dry run mode", async () => {
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

      const siteConfig = {
        title: "Test Site",
        description: "Test",
        baseUrl: "https://example.com",
        domain: "test",
      };

      await expect(uploader.upload(testUploadDir, siteConfig)).resolves.toBeUndefined();

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should handle upload errors", async () => {
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

      const siteConfig = {
        title: "Test Site",
        description: "Test",
        baseUrl: "https://example.com",
        domain: "test",
      };

      // Use non-existent path to trigger error
      try {
        await uploader.upload("/non/existent/path/to/site", siteConfig);
      } catch (error) {
        expect(error).toBeDefined();
      }

      delete process.env.BUNKI_DRY_RUN;
    });
  });

  describe("Image Upload Error Handling", () => {
    test("should handle non-existent images directory", async () => {
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

      const result = await uploader.uploadImages("/non/existent/images/dir");

      expect(result).toEqual({});

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should handle empty images directory", async () => {
      const emptyDir = path.join(import.meta.dir, "empty-images");
      await ensureDir(emptyDir);

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

      const result = await uploader.uploadImages(emptyDir);

      expect(result).toEqual({});

      delete process.env.BUNKI_DRY_RUN;

      // Clean up
      try {
        await Bun.file(emptyDir).rm?.({ recursive: true });
      } catch {}
    });
  });

  describe("Public URL Generation", () => {
    test("should generate URLs with custom domain", async () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "my-bucket",
        publicUrl: "https://my-bucket.s3.amazonaws.com",
        endpoint: "https://s3.amazonaws.com",
        region: "us-east-1",
      };

      // Set custom domain via environment variable
      process.env.S3_CUSTOM_DOMAIN_MY_BUCKET = "cdn.example.com";

      process.env.BUNKI_DRY_RUN = "true";
      const uploader = new S3Uploader(config);

      // Create test images with known URLs
      const testDir = path.join(import.meta.dir, "test-custom-domain-images");
      await ensureDir(testDir);
      const jpgContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      await Bun.write(path.join(testDir, "test-image.jpg"), jpgContent);

      const result = await uploader.uploadImages(testDir);

      // Custom domain should be used
      const imageUrl = result["test-image.jpg"];
      expect(imageUrl).toContain("cdn.example.com");
      expect(imageUrl).toContain("test-image.jpg");

      delete process.env.S3_CUSTOM_DOMAIN_MY_BUCKET;
      delete process.env.BUNKI_DRY_RUN;

      // Clean up
      try {
        await Bun.file(testDir).rm?.({ recursive: true });
      } catch {}
    });

    test("should generate URLs with hyphenated bucket names", async () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "my-hyphenated-bucket",
        publicUrl: "https://my-hyphenated-bucket.s3.amazonaws.com",
        region: "us-east-1",
      };

      // Set custom domain with underscores (bucket hyphens converted to underscores)
      process.env.S3_CUSTOM_DOMAIN_MY_HYPHENATED_BUCKET =
        "cdn-hyphenated.example.com";

      process.env.BUNKI_DRY_RUN = "true";
      const uploader = new S3Uploader(config);

      const testDir = path.join(import.meta.dir, "test-hyphenated-images");
      await ensureDir(testDir);
      const jpgContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      await Bun.write(path.join(testDir, "img.jpg"), jpgContent);

      const result = await uploader.uploadImages(testDir);

      const imageUrl = result["img.jpg"];
      expect(imageUrl).toContain("cdn-hyphenated.example.com");

      delete process.env.S3_CUSTOM_DOMAIN_MY_HYPHENATED_BUCKET;
      delete process.env.BUNKI_DRY_RUN;

      // Clean up
      try {
        await Bun.file(testDir).rm?.({ recursive: true });
      } catch {}
    });

    test("should generate URLs with bucket in public URL", async () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        publicUrl: "https://cdn.example.com/test-bucket",
        region: "us-east-1",
      };

      process.env.BUNKI_DRY_RUN = "true";
      const uploader = new S3Uploader(config);

      const testDir = path.join(import.meta.dir, "test-bucket-in-url-images");
      await ensureDir(testDir);
      const jpgContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      await Bun.write(path.join(testDir, "photo.jpg"), jpgContent);

      const result = await uploader.uploadImages(testDir);

      // Should not duplicate bucket name since it's already in publicUrl
      const imageUrl = result["photo.jpg"];
      expect(imageUrl).toContain("https://cdn.example.com/test-bucket/photo.jpg");

      delete process.env.BUNKI_DRY_RUN;

      // Clean up
      try {
        await Bun.file(testDir).rm?.({ recursive: true });
      } catch {}
    });

    test("should handle different file formats", async () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        publicUrl: "https://test-bucket.example.com",
        region: "us-east-1",
      };

      process.env.BUNKI_DRY_RUN = "true";
      const uploader = new S3Uploader(config);

      const testDir = path.join(import.meta.dir, "test-formats-images");
      await ensureDir(testDir);

      // Create test files with different extensions
      const jpgContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const pngContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const gifContent = Buffer.from([0x47, 0x49, 0x46]);
      const webpContent = Buffer.from([0x52, 0x49, 0x46, 0x46]);

      await Bun.write(path.join(testDir, "image.jpg"), jpgContent);
      await Bun.write(path.join(testDir, "image.png"), pngContent);
      await Bun.write(path.join(testDir, "image.gif"), gifContent);
      await Bun.write(path.join(testDir, "image.webp"), webpContent);

      const result = await uploader.uploadImages(testDir);

      // All file formats should be included
      expect(Object.keys(result).length).toBe(4);
      expect(result["image.jpg"]).toBeDefined();
      expect(result["image.png"]).toBeDefined();
      expect(result["image.gif"]).toBeDefined();
      expect(result["image.webp"]).toBeDefined();

      delete process.env.BUNKI_DRY_RUN;

      // Clean up
      try {
        await Bun.file(testDir).rm?.({ recursive: true });
      } catch {}
    });
  });

  describe("Year Filtering with minYear Parameter", () => {
    const yearFilterDir = path.join(import.meta.dir, "test-year-filter-images");

    beforeAll(async () => {
      // Create test image structure with multiple years
      await ensureDir(path.join(yearFilterDir, "2021/post-1"));
      await ensureDir(path.join(yearFilterDir, "2022/post-2"));
      await ensureDir(path.join(yearFilterDir, "2023/post-3"));
      await ensureDir(path.join(yearFilterDir, "2024/post-4"));

      const jpgContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      // Create images in each year
      await Bun.write(
        path.join(yearFilterDir, "2021/post-1/image.jpg"),
        jpgContent,
      );
      await Bun.write(
        path.join(yearFilterDir, "2022/post-2/image.jpg"),
        jpgContent,
      );
      await Bun.write(
        path.join(yearFilterDir, "2023/post-3/image.jpg"),
        jpgContent,
      );
      await Bun.write(
        path.join(yearFilterDir, "2024/post-4/image.jpg"),
        jpgContent,
      );
    });

    afterAll(async () => {
      try {
        await Bun.file(yearFilterDir).rm?.({ recursive: true });
      } catch {}
    });

    test("should upload all images when minYear is not specified", async () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        publicUrl: "https://test-bucket.example.com",
        region: "us-east-1",
      };

      process.env.BUNKI_DRY_RUN = "true";
      const uploader = new S3Uploader(config);

      const result = await uploader.uploadImages(yearFilterDir);

      // Should have all 4 images
      expect(Object.keys(result).length).toBe(4);
      expect(result["2021/post-1/image.jpg"]).toBeDefined();
      expect(result["2022/post-2/image.jpg"]).toBeDefined();
      expect(result["2023/post-3/image.jpg"]).toBeDefined();
      expect(result["2024/post-4/image.jpg"]).toBeDefined();

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should filter images by minYear 2023 or later", async () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        publicUrl: "https://test-bucket.example.com",
        region: "us-east-1",
      };

      process.env.BUNKI_DRY_RUN = "true";
      const uploader = new S3Uploader(config);

      const result = await uploader.uploadImages(yearFilterDir, 2023);

      // Should only have images from 2023 and 2024
      expect(Object.keys(result).length).toBe(2);
      expect(result["2023/post-3/image.jpg"]).toBeDefined();
      expect(result["2024/post-4/image.jpg"]).toBeDefined();
      expect(result["2021/post-1/image.jpg"]).toBeUndefined();
      expect(result["2022/post-2/image.jpg"]).toBeUndefined();

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should filter images by minYear 2022 or later", async () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        publicUrl: "https://test-bucket.example.com",
        region: "us-east-1",
      };

      process.env.BUNKI_DRY_RUN = "true";
      const uploader = new S3Uploader(config);

      const result = await uploader.uploadImages(yearFilterDir, 2022);

      // Should have images from 2022, 2023, and 2024
      expect(Object.keys(result).length).toBe(3);
      expect(result["2022/post-2/image.jpg"]).toBeDefined();
      expect(result["2023/post-3/image.jpg"]).toBeDefined();
      expect(result["2024/post-4/image.jpg"]).toBeDefined();
      expect(result["2021/post-1/image.jpg"]).toBeUndefined();

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should handle minYear greater than all available years", async () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        publicUrl: "https://test-bucket.example.com",
        region: "us-east-1",
      };

      process.env.BUNKI_DRY_RUN = "true";
      const uploader = new S3Uploader(config);

      const result = await uploader.uploadImages(yearFilterDir, 2025);

      // Should have no images
      expect(Object.keys(result).length).toBe(0);

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should handle minYear matching earliest year", async () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        publicUrl: "https://test-bucket.example.com",
        region: "us-east-1",
      };

      process.env.BUNKI_DRY_RUN = "true";
      const uploader = new S3Uploader(config);

      const result = await uploader.uploadImages(yearFilterDir, 2021);

      // Should have all images
      expect(Object.keys(result).length).toBe(4);

      delete process.env.BUNKI_DRY_RUN;
    });
  });
});
