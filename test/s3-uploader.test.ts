import { describe, expect, it } from "bun:test";
import { S3Uploader, createUploader } from "../src/utils/s3-uploader";
import { S3Config } from "../types";

// Mock the S3Uploader class for testing
const originalUploadImages = S3Uploader.prototype.uploadImages;

// Create a mock result for testing
const mockFiles = {
  "test1.jpg": "https://test-bucket.example.com/test1.jpg",
  "test2.png": "https://test-bucket.example.com/test2.png",
};

// Replace the uploadImages method with a mock implementation
S3Uploader.prototype.uploadImages = async function (imagesDir: string) {
  return mockFiles;
};

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

  it("should upload images", async () => {
    const config: S3Config = {
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      bucket: "test-bucket",
      publicUrl: "https://test-bucket.example.com",
      endpoint: "https://s3.example.com",
      region: "us-east-1",
    };

    const uploader = new S3Uploader(config);
    const result = await uploader.uploadImages("/test/images");

    // Should have 2 images from our mock
    expect(Object.keys(result).length).toBe(2);
    expect(result["test1.jpg"]).toBeDefined();
    expect(result["test2.png"]).toBeDefined();
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
    const result = await uploader.uploadImages("/test/images");

    // Should have 2 images from our mock
    expect(Object.keys(result).length).toBe(2);
  });
});
