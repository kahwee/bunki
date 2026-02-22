/**
 * Build performance metrics and tracking
 */

export interface BuildMetrics {
  totalTime: number;
  stages: {
    initialization: number;
    cssProcessing: number;
    pageGeneration: number;
    feedGeneration: number;
    assetCopying: number;
  };
  outputs: {
    posts: number;
    pages: number;
    totalSize: number;
  };
}

export interface BuildStage {
  name: keyof BuildMetrics["stages"];
  startTime: number;
}

export class MetricsCollector {
  private startTime: number;
  private stageTimings: Map<string, number> = new Map();
  private currentStage: BuildStage | null = null;

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Start tracking a build stage
   */
  startStage(name: keyof BuildMetrics["stages"]): void {
    // End current stage if one is running
    if (this.currentStage) {
      this.endStage();
    }

    this.currentStage = {
      name,
      startTime: performance.now(),
    };
  }

  /**
   * End the current build stage
   */
  endStage(): void {
    if (!this.currentStage) {
      return;
    }

    const duration = performance.now() - this.currentStage.startTime;
    this.stageTimings.set(this.currentStage.name, duration);
    this.currentStage = null;
  }

  /**
   * Get final build metrics
   */
  getMetrics(outputs: {
    posts: number;
    pages: number;
    totalSize: number;
  }): BuildMetrics {
    // End any running stage
    if (this.currentStage) {
      this.endStage();
    }

    const totalTime = performance.now() - this.startTime;

    return {
      totalTime,
      stages: {
        initialization: this.stageTimings.get("initialization") || 0,
        cssProcessing: this.stageTimings.get("cssProcessing") || 0,
        pageGeneration: this.stageTimings.get("pageGeneration") || 0,
        feedGeneration: this.stageTimings.get("feedGeneration") || 0,
        assetCopying: this.stageTimings.get("assetCopying") || 0,
      },
      outputs,
    };
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Display build metrics in the console
 */
export function displayMetrics(metrics: BuildMetrics): void {
  console.log(`\n📊 Build Complete in ${metrics.totalTime.toFixed(0)}ms\n`);

  console.log("⏱️  Timing Breakdown:");
  console.log(
    `   Initialization:  ${metrics.stages.initialization.toFixed(0)}ms`,
  );
  console.log(
    `   CSS Processing:  ${metrics.stages.cssProcessing.toFixed(0)}ms`,
  );
  console.log(
    `   Page Generation: ${metrics.stages.pageGeneration.toFixed(0)}ms`,
  );
  console.log(
    `   Feed Generation: ${metrics.stages.feedGeneration.toFixed(0)}ms`,
  );
  console.log(
    `   Asset Copying:   ${metrics.stages.assetCopying.toFixed(0)}ms`,
  );

  console.log(`\n📦 Output:`);
  console.log(`   Posts:     ${metrics.outputs.posts}`);
  console.log(`   Pages:     ${metrics.outputs.pages}`);
  console.log(`   Total:     ${formatBytes(metrics.outputs.totalSize)}\n`);
}
