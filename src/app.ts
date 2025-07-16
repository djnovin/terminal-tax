import * as readline from "node:readline";

type TaxBracket = {
  readonly min: number;
  readonly max: number;
  readonly rate: number;
  readonly base: number;
};

type TaxResult = {
  readonly year: string;
  readonly income: number;
  readonly tax: number;
  readonly afterTax: number;
  readonly effectiveRate: number;
};

// Tax brackets with numeric separators for readability
const TAX_BRACKETS: Record<string, readonly TaxBracket[]> = {
  "2023-2024": [
    { min: 0, max: 18_200, rate: 0, base: 0 },
    { min: 18_200, max: 45_000, rate: 0.19, base: 0 },
    { min: 45_000, max: 120_000, rate: 0.325, base: 5_092 },
    { min: 120_000, max: 180_000, rate: 0.37, base: 29_467 },
    { min: 180_000, max: Number.POSITIVE_INFINITY, rate: 0.45, base: 51_667 },
  ],
  "2024-2025": [
    { min: 0, max: 18_200, rate: 0, base: 0 },
    { min: 18_200, max: 45_000, rate: 0.16, base: 0 },
    { min: 45_000, max: 135_000, rate: 0.3, base: 4_288 },
    { min: 135_000, max: 190_000, rate: 0.37, base: 31_388 },
    { min: 190_000, max: Number.POSITIVE_INFINITY, rate: 0.45, base: 51_838 },
  ],
} as const;

// TaxService class for better organization and testing
export class TaxService {
  getAvailableYears(): readonly string[] {
    return Object.keys(TAX_BRACKETS);
  }

  calculateTax(year: string, income: number): number {
    const brackets = TAX_BRACKETS[year as keyof typeof TAX_BRACKETS];
    if (!brackets) throw new Error(`Invalid tax year: ${year}`);

    const bracket = brackets.findLast((b) => income > b.min);
    if (!bracket) return 0;

    const tax = bracket.base + (income - bracket.min) * bracket.rate;
    return Math.round(tax * 100) / 100;
  }

  calculateResult(year: string, income: number): TaxResult {
    const tax = this.calculateTax(year, income);
    const afterTax = income - tax;
    const effectiveRate = income > 0 ? (tax / income) * 100 : 0;

    return {
      year,
      income,
      tax,
      afterTax,
      effectiveRate,
    };
  }

  validateYear(
    input: string,
  ): { success: true; data: string } | { success: false; error: string } {
    const availableYears = this.getAvailableYears();

    if (!input.trim()) {
      return { success: false, error: "Year cannot be empty" };
    }

    if (!/^\d{4}-\d{4}$/.test(input)) {
      return {
        success: false,
        error: "Year must be in format YYYY-YYYY (e.g., 2023-2024)",
      };
    }

    if (!availableYears.includes(input)) {
      return {
        success: false,
        error: `Year "${input}" not available. Choose from: ${availableYears.join(", ")}`,
      };
    }

    return { success: true, data: input };
  }

  validateIncome(
    input: string,
  ): { success: true; data: number } | { success: false; error: string } {
    if (!input.trim()) {
      return { success: false, error: "Income cannot be empty" };
    }

    const income = Number(input);

    if (Number.isNaN(income)) {
      return { success: false, error: "Please enter a valid numeric income" };
    }

    if (income < 0) {
      return { success: false, error: "Income cannot be negative" };
    }

    if (income > 999_999_999.99) {
      return { success: false, error: "Income exceeds maximum allowed value" };
    }

    return { success: true, data: income };
  }
}

// Simple interface for testability
export interface InputProvider {
  prompt(question: string): Promise<string>;
}

export interface OutputProvider {
  log(message: string): void;
  showResult(result: TaxResult): void;
}

// Default implementations
export class ConsoleInputProvider implements InputProvider {
  async prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
}

export class ConsoleOutputProvider implements OutputProvider {
  log(message: string): void {
    console.log(message);
  }

  showResult(result: TaxResult): void {
    console.log(`\n--- Tax Calculation Result ---`);
    console.log(`Year:           ${result.year}`);
    console.log(`Income:         $${result.income.toLocaleString()}`);
    console.log(`Tax Payable:    $${result.tax.toLocaleString()}`);
    console.log(`After Tax:      $${result.afterTax.toLocaleString()}`);
    console.log(`Effective Rate: ${result.effectiveRate.toFixed(2)}%\n`);
  }
}

export class TaxCalculator {
  constructor(
    private input: InputProvider = new ConsoleInputProvider(),
    private output: OutputProvider = new ConsoleOutputProvider(),
    private taxService: TaxService = new TaxService(),
  ) {}

  async getValidYear(): Promise<string> {
    while (true) {
      const yearInput = await this.input.prompt(
        "Please enter the income year (e.g., 2023-2024): ",
      );
      const validation = this.taxService.validateYear(yearInput);

      if (validation.success) {
        return validation.data;
      }

      this.output.log(validation.error);
    }
  }

  async getValidIncome(): Promise<number> {
    while (true) {
      const incomeInput = await this.input.prompt(
        "Please enter your total taxable income: $",
      );
      const validation = this.taxService.validateIncome(incomeInput);

      if (validation.success) {
        return validation.data;
      }

      this.output.log(validation.error);
    }
  }

  async run(): Promise<TaxResult> {
    const year = await this.getValidYear();
    const income = await this.getValidIncome();
    const result = this.taxService.calculateResult(year, income);

    this.output.showResult(result);
    return result;
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await new TaxCalculator().run();
}
