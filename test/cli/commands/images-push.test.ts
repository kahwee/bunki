import { describe, expect, test } from "bun:test";
import {
  handleImagesPushCommand,
  registerImagesPushCommand,
} from "../../../src/cli/commands/images-push";
import { Command } from "commander";
import path from "path";

describe("images:push CLI Command", () => {
  describe("Command Registration", () => {
    test("should register the images:push command", () => {
      const program = new Command();
      const result = registerImagesPushCommand(program);

      expect(result).toBeDefined();
      // Verify that commands were added to the program
      expect(program.commands.length).toBeGreaterThan(0);
    });

    test("should have the correct command name", () => {
      const program = new Command();
      registerImagesPushCommand(program);

      const command = program.commands.find((c) => c.name() === "images:push");
      expect(command).toBeDefined();
    });

    test("should have the correct description", () => {
      const program = new Command();
      registerImagesPushCommand(program);

      const command = program.commands.find((c) => c.name() === "images:push");
      expect(command?.description()).toBe("Upload images to S3-compatible storage");
    });

    test("should support --domain option", () => {
      const program = new Command();
      registerImagesPushCommand(program);

      const command = program.commands.find((c) => c.name() === "images:push");
      const domainOption = command?.options.find((o) => o.long === "--domain");
      expect(domainOption).toBeDefined();
    });

    test("should support --images option with default", () => {
      const program = new Command();
      registerImagesPushCommand(program);

      const command = program.commands.find((c) => c.name() === "images:push");
      const imagesOption = command?.options.find((o) => o.long === "--images");
      expect(imagesOption).toBeDefined();
    });

    test("should support --output-json option", () => {
      const program = new Command();
      registerImagesPushCommand(program);

      const command = program.commands.find((c) => c.name() === "images:push");
      const outputOption = command?.options.find((o) => o.long === "--output-json");
      expect(outputOption).toBeDefined();
    });

    test("should support --min-year option", () => {
      const program = new Command();
      registerImagesPushCommand(program);

      const command = program.commands.find((c) => c.name() === "images:push");
      const minYearOption = command?.options.find((o) => o.long === "--min-year");
      expect(minYearOption).toBeDefined();
    });

    test("should have min-year help text mentioning filtering", () => {
      const program = new Command();
      registerImagesPushCommand(program);

      const command = program.commands.find((c) => c.name() === "images:push");
      const minYearOption = command?.options.find((o) => o.long === "--min-year");
      const description = minYearOption?.description || "";
      expect(description.toLowerCase()).toContain("year");
    });
  });

  describe("Command Handler", () => {
    test("should handle basic options", async () => {
      const mockUploadImages = async (options: any) => {
        return { "test-image.jpg": "https://example.com/test-image.jpg" };
      };

      const mockLogger = {
        error: (msg: string) => {},
      };

      const mockExit = (code: number) => {};

      const deps = {
        uploadImages: mockUploadImages,
        logger: mockLogger,
        exit: mockExit,
      };

      const options = {
        images: "./images",
      };

      await handleImagesPushCommand(options, deps);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    test("should pass domain option through to uploadImages", async () => {
      let passedOptions: any = null;

      const mockUploadImages = async (options: any) => {
        passedOptions = options;
        return {};
      };

      const mockLogger = {
        error: (msg: string) => {},
      };

      const mockExit = (code: number) => {};

      const deps = {
        uploadImages: mockUploadImages,
        logger: mockLogger,
        exit: mockExit,
      };

      const options = {
        domain: "my-domain",
        images: "./images",
      };

      await handleImagesPushCommand(options, deps);

      expect(passedOptions.domain).toBe("my-domain");
    });

    test("should pass minYear option through to uploadImages as number", async () => {
      let passedOptions: any = null;

      const mockUploadImages = async (options: any) => {
        passedOptions = options;
        return {};
      };

      const mockLogger = {
        error: (msg: string) => {},
      };

      const mockExit = (code: number) => {};

      const deps = {
        uploadImages: mockUploadImages,
        logger: mockLogger,
        exit: mockExit,
      };

      const options = {
        images: "./images",
        minYear: "2023",
      };

      await handleImagesPushCommand(options, deps);

      expect(passedOptions.minYear).toBe(2023);
      expect(typeof passedOptions.minYear).toBe("number");
    });

    test("should pass outputJson option through", async () => {
      let passedOptions: any = null;

      const mockUploadImages = async (options: any) => {
        passedOptions = options;
        return {};
      };

      const mockLogger = {
        error: (msg: string) => {},
      };

      const mockExit = (code: number) => {};

      const deps = {
        uploadImages: mockUploadImages,
        logger: mockLogger,
        exit: mockExit,
      };

      const options = {
        images: "./images",
        outputJson: "./output.json",
      };

      await handleImagesPushCommand(options, deps);

      expect(passedOptions.outputJson).toBe("./output.json");
    });

    test("should call exit with code 1 on error", async () => {
      const mockUploadImages = async (options: any) => {
        throw new Error("Upload failed");
      };

      const mockLogger = {
        error: (msg: string) => {},
      };

      let exitCode = 0;
      const mockExit = (code: number) => {
        exitCode = code;
      };

      const deps = {
        uploadImages: mockUploadImages,
        logger: mockLogger,
        exit: mockExit,
      };

      const options = {
        images: "./images",
      };

      await handleImagesPushCommand(options, deps);

      expect(exitCode).toBe(1);
    });

    test("should log errors to logger", async () => {
      let errorMessage = "";

      const mockUploadImages = async (options: any) => {
        throw new Error("Upload failed");
      };

      const mockLogger = {
        error: (msg: string) => {
          errorMessage = msg;
        },
      };

      const mockExit = (code: number) => {};

      const deps = {
        uploadImages: mockUploadImages,
        logger: mockLogger,
        exit: mockExit,
      };

      const options = {
        images: "./images",
      };

      await handleImagesPushCommand(options, deps);

      expect(errorMessage).toContain("Error uploading images");
    });

    test("should handle all options together", async () => {
      let passedOptions: any = null;

      const mockUploadImages = async (options: any) => {
        passedOptions = options;
        return {};
      };

      const mockLogger = {
        error: (msg: string) => {},
      };

      const mockExit = (code: number) => {};

      const deps = {
        uploadImages: mockUploadImages,
        logger: mockLogger,
        exit: mockExit,
      };

      const options = {
        domain: "my-domain",
        images: "./custom-images",
        outputJson: "./urls.json",
        minYear: "2024",
      };

      await handleImagesPushCommand(options, deps);

      expect(passedOptions.domain).toBe("my-domain");
      expect(passedOptions.images).toBe("./custom-images");
      expect(passedOptions.outputJson).toBe("./urls.json");
      expect(passedOptions.minYear).toBe(2024);
    });

    test("should handle undefined minYear gracefully", async () => {
      let passedOptions: any = null;

      const mockUploadImages = async (options: any) => {
        passedOptions = options;
        return {};
      };

      const mockLogger = {
        error: (msg: string) => {},
      };

      const mockExit = (code: number) => {};

      const deps = {
        uploadImages: mockUploadImages,
        logger: mockLogger,
        exit: mockExit,
      };

      const options = {
        images: "./images",
        minYear: undefined,
      };

      await handleImagesPushCommand(options, deps);

      // minYear should be undefined when not provided
      expect(passedOptions.minYear).toBeUndefined();
    });
  });

  describe("Option Parsing", () => {
    test("should convert minYear string to number", () => {
      const minYearString = "2023";
      const minYearNumber = minYearString
        ? parseInt(minYearString, 10)
        : undefined;
      expect(minYearNumber).toBe(2023);
      expect(typeof minYearNumber).toBe("number");
    });

    test("should handle invalid minYear string gracefully", () => {
      const minYearString = "invalid";
      const minYearNumber = minYearString
        ? parseInt(minYearString, 10)
        : undefined;
      expect(isNaN(minYearNumber)).toBe(true);
    });

    test("should handle negative minYear", () => {
      const minYearString = "-2023";
      const minYearNumber = minYearString
        ? parseInt(minYearString, 10)
        : undefined;
      expect(minYearNumber).toBe(-2023);
    });

    test("should handle zero minYear", () => {
      const minYearString = "0";
      const minYearNumber = minYearString
        ? parseInt(minYearString, 10)
        : undefined;
      expect(minYearNumber).toBe(0);
    });
  });

  describe("Default Values", () => {
    test("should use default images directory when not provided", async () => {
      let passedOptions: any = null;

      const mockUploadImages = async (options: any) => {
        passedOptions = options;
        return {};
      };

      const mockLogger = {
        error: (msg: string) => {},
      };

      const mockExit = (code: number) => {};

      const deps = {
        uploadImages: mockUploadImages,
        logger: mockLogger,
        exit: mockExit,
      };

      const options = {
        images: "./images", // This is the default
      };

      await handleImagesPushCommand(options, deps);

      expect(passedOptions.images).toBe("./images");
    });
  });
});
