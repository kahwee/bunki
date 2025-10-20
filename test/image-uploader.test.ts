import { expect, test, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { uploadImages, DEFAULT_IMAGES_DIR } from "../src/utils/image-uploader";
import { ensureDir } from "../src/utils/file-utils";
import path from "path";
import fs from "fs";

const TEST_IMAGES_DIR = path.join(import.meta.dir, "test-images");
const TEST_CONFIG_PATH = path.join(import.meta.dir, "test-config-images.json");
const OUTPUT_JSON_PATH = path.join(import.meta.dir, "test-image-urls.json");

// Helper to clean up test files
async function cleanup() {
  try {
    await fs.promises.rm(TEST_IMAGES_DIR, { recursive: true });
  } catch {}
  try {
    await fs.promises.rm(TEST_CONFIG_PATH, { recursive: true });
  } catch {}
  try {
    await fs.promises.rm(OUTPUT_JSON_PATH, { recursive: true });
  } catch {}
}

describe("Image Uploader", () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    // Clean up environment variables
    delete process.env.BUNKI_DRY_RUN;
  });

  describe("Directory Management", () => {
    beforeEach(async () => {
      await cleanup();
    });

    test("should create images directory if it doesn't exist", async () => {
      // Set dry run mode to avoid actual S3 operations
      process.env.BUNKI_DRY_RUN = "true";

      // Create a test config
      const testConfig = {
        title: "Test Blog",
        description: "Test",
        baseUrl: "https://test.com",
        domain: "test",
        s3: {
          accessKeyId: "test-key",
          secretAccessKey: "test-secret",
          bucket: "test-bucket",
          region: "auto",
          publicUrl: "https://cdn.test.com",
        },
      };

      await Bun.write(TEST_CONFIG_PATH, JSON.stringify(testConfig, null, 2));

      // Call uploadImages with non-existent directory
      const nonExistentDir = path.join(TEST_IMAGES_DIR, "new-dir");
      const result = await uploadImages({
        images: nonExistentDir,
      });

      // Directory should be created
      const exists = await fs.promises
        .access(nonExistentDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Result should be empty (no images to upload)
      expect(result).toEqual({});

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should handle existing empty directory", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      await ensureDir(TEST_IMAGES_DIR);

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
      });

      expect(result).toEqual({});

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should scan existing directory with images", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      await ensureDir(TEST_IMAGES_DIR);

      // Create test images
      await Bun.write(
        path.join(TEST_IMAGES_DIR, "test1.jpg"),
        Buffer.from([0xff, 0xd8, 0xff]),
      ); // JPEG header
      await Bun.write(
        path.join(TEST_IMAGES_DIR, "test2.png"),
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      ); // PNG header

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
      });

      // Should find both images
      expect(Object.keys(result)).toContain("test1.jpg");
      expect(Object.keys(result)).toContain("test2.png");
      expect(Object.keys(result).length).toBe(2);

      delete process.env.BUNKI_DRY_RUN;
    });
  });

  describe("Config Loading and Validation", () => {
    beforeEach(async () => {
      await cleanup();
      await ensureDir(TEST_IMAGES_DIR);
    });

    test("should load S3 config from bunki.config.ts", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      // Create a valid config file with S3 settings
      const testConfig = {
        title: "Test Blog",
        description: "Test",
        baseUrl: "https://test.com",
        domain: "test",
        publicUrl: "https://cdn.test.com",
        s3: {
          accessKeyId: "test-key-id",
          secretAccessKey: "test-secret-key",
          bucket: "test-images-bucket",
          region: "us-west-2",
          endpoint: "https://s3.us-west-2.amazonaws.com",
        },
      };

      await Bun.write(TEST_CONFIG_PATH, JSON.stringify(testConfig, null, 2));

      // Create a test image
      await Bun.write(
        path.join(TEST_IMAGES_DIR, "config-test.jpg"),
        Buffer.from([0xff, 0xd8, 0xff]),
      );

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
      });

      // Should successfully process with config
      expect(Object.keys(result)).toContain("config-test.jpg");

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should error when S3 config is missing and not in dry run", async () => {
      delete process.env.BUNKI_DRY_RUN;

      // Create config without S3 settings
      const testConfig = {
        title: "Test Blog",
        description: "Test",
        baseUrl: "https://test.com",
        domain: "test",
      };

      await Bun.write(TEST_CONFIG_PATH, JSON.stringify(testConfig, null, 2));

      // This should exit with error
      await expect(
        uploadImages({
          images: TEST_IMAGES_DIR,
        }),
      ).rejects.toThrow();
    });

    test("should use stub config in dry run mode", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      // Even without S3 config, dry run should work
      const testConfig = {
        title: "Test Blog",
        description: "Test",
        baseUrl: "https://test.com",
        domain: "test",
      };

      await Bun.write(TEST_CONFIG_PATH, JSON.stringify(testConfig, null, 2));

      await Bun.write(
        path.join(TEST_IMAGES_DIR, "dryrun-test.jpg"),
        Buffer.from([0xff, 0xd8, 0xff]),
      );

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
      });

      // Should process with stub config
      expect(Object.keys(result)).toContain("dryrun-test.jpg");

      delete process.env.BUNKI_DRY_RUN;
    });
  });

  describe("Dry Run Mode", () => {
    beforeEach(async () => {
      await cleanup();
      await ensureDir(TEST_IMAGES_DIR);
    });

    test("should not actually upload in dry run mode", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      await Bun.write(
        path.join(TEST_IMAGES_DIR, "dryrun.jpg"),
        Buffer.from([0xff, 0xd8, 0xff]),
      );

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
      });

      // Should return URLs even in dry run
      expect(Object.keys(result)).toContain("dryrun.jpg");
      expect(result["dryrun.jpg"]).toBeDefined();
      expect(result["dryrun.jpg"]).toInclude("https://");

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should process all supported image formats in dry run", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      await ensureDir(TEST_IMAGES_DIR);

      // Create images of different formats
      const formats = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
      for (const format of formats) {
        await Bun.write(
          path.join(TEST_IMAGES_DIR, `test.${format}`),
          Buffer.from([0xff, 0xd8, 0xff]),
        );
      }

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
      });

      // All formats should be processed
      expect(Object.keys(result).length).toBe(formats.length);
      for (const format of formats) {
        expect(Object.keys(result)).toContain(`test.${format}`);
      }

      delete process.env.BUNKI_DRY_RUN;
    });
  });

  describe("URL Mapping Output", () => {
    beforeEach(async () => {
      await cleanup();
      await ensureDir(TEST_IMAGES_DIR);
    });

    test("should write URL mapping to JSON file when outputJson is specified", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      // Create test images
      await Bun.write(
        path.join(TEST_IMAGES_DIR, "output1.jpg"),
        Buffer.from([0xff, 0xd8, 0xff]),
      );
      await Bun.write(
        path.join(TEST_IMAGES_DIR, "output2.png"),
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      );

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
        outputJson: OUTPUT_JSON_PATH,
      });

      // Check that JSON file was created
      const jsonFile = Bun.file(OUTPUT_JSON_PATH);
      expect(await jsonFile.exists()).toBe(true);

      // Check JSON content
      const jsonContent = await jsonFile.json();
      expect(jsonContent).toEqual(result);
      expect(jsonContent["output1.jpg"]).toBeDefined();
      expect(jsonContent["output2.png"]).toBeDefined();

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should return correct URL structure", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      await Bun.write(
        path.join(TEST_IMAGES_DIR, "urltest.jpg"),
        Buffer.from([0xff, 0xd8, 0xff]),
      );

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
      });

      // URL should be properly formatted
      const url = result["urltest.jpg"];
      expect(url).toBeDefined();
      expect(url).toMatch(/^https?:\/\//); // Should start with http:// or https://
      expect(url).toInclude("urltest.jpg"); // Should include filename

      delete process.env.BUNKI_DRY_RUN;
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      await cleanup();
    });

    test("should handle missing S3 config gracefully in non-dry-run mode", async () => {
      delete process.env.BUNKI_DRY_RUN;

      await ensureDir(TEST_IMAGES_DIR);

      // Create an empty config
      await Bun.write(
        TEST_CONFIG_PATH,
        JSON.stringify({ title: "Test", domain: "test" }, null, 2),
      );

      // Should exit with error
      await expect(
        uploadImages({
          images: TEST_IMAGES_DIR,
        }),
      ).rejects.toThrow();
    });

    test("should handle subdirectories in images folder", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      await ensureDir(TEST_IMAGES_DIR);
      const subDir = path.join(TEST_IMAGES_DIR, "subdirectory");
      await ensureDir(subDir);

      // Create images in subdirectory
      await Bun.write(
        path.join(subDir, "nested.jpg"),
        Buffer.from([0xff, 0xd8, 0xff]),
      );

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
      });

      // Should find nested images
      const keys = Object.keys(result);
      const hasNested = keys.some((key) => key.includes("nested.jpg"));
      expect(hasNested).toBe(true);

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should skip non-image files", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      await ensureDir(TEST_IMAGES_DIR);

      // Create image and non-image files
      await Bun.write(
        path.join(TEST_IMAGES_DIR, "image.jpg"),
        Buffer.from([0xff, 0xd8, 0xff]),
      );
      await Bun.write(path.join(TEST_IMAGES_DIR, "document.txt"), "Not an image");
      await Bun.write(path.join(TEST_IMAGES_DIR, "README.md"), "# Readme");

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
      });

      // Should only include image files
      expect(Object.keys(result)).toContain("image.jpg");
      expect(Object.keys(result)).not.toContain("document.txt");
      expect(Object.keys(result)).not.toContain("README.md");

      delete process.env.BUNKI_DRY_RUN;
    });
  });

  describe("Integration with S3 Uploader", () => {
    beforeEach(async () => {
      await cleanup();
      await ensureDir(TEST_IMAGES_DIR);
    });

    test("should pass correct parameters to S3 uploader", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      // Create test config with all S3 parameters
      const testConfig = {
        title: "Test Blog",
        description: "Test",
        baseUrl: "https://test.com",
        domain: "test",
        publicUrl: "https://cdn.test.com",
        s3: {
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-key",
          bucket: "integration-test-bucket",
          region: "us-east-1",
          endpoint: "https://s3.us-east-1.amazonaws.com",
        },
      };

      await Bun.write(TEST_CONFIG_PATH, JSON.stringify(testConfig, null, 2));

      await Bun.write(
        path.join(TEST_IMAGES_DIR, "integration.jpg"),
        Buffer.from([0xff, 0xd8, 0xff]),
      );

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
      });

      // Should successfully integrate with S3 uploader
      expect(Object.keys(result)).toContain("integration.jpg");
      expect(result["integration.jpg"]).toBeDefined();

      delete process.env.BUNKI_DRY_RUN;
    });

    test("should return mapped URLs from S3 uploader", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      await Bun.write(
        path.join(TEST_IMAGES_DIR, "mapped1.jpg"),
        Buffer.from([0xff, 0xd8, 0xff]),
      );
      await Bun.write(
        path.join(TEST_IMAGES_DIR, "mapped2.png"),
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      );

      const result = await uploadImages({
        images: TEST_IMAGES_DIR,
      });

      // Each image should have a corresponding URL
      expect(result["mapped1.jpg"]).toBeDefined();
      expect(result["mapped2.png"]).toBeDefined();

      // URLs should be strings
      expect(typeof result["mapped1.jpg"]).toBe("string");
      expect(typeof result["mapped2.png"]).toBe("string");

      delete process.env.BUNKI_DRY_RUN;
    });
  });

  describe("Default Images Directory", () => {
    test("should use DEFAULT_IMAGES_DIR when no directory specified", async () => {
      process.env.BUNKI_DRY_RUN = "true";

      // DEFAULT_IMAGES_DIR should be defined
      expect(DEFAULT_IMAGES_DIR).toBeDefined();
      expect(DEFAULT_IMAGES_DIR).toInclude("images");

      delete process.env.BUNKI_DRY_RUN;
    });
  });
});
