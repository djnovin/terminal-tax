import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type IInputProvider,
  type IOutputProvider,
  TaxCalculator,
  TaxService,
} from "../src/app.js";

describe("TaxService", () => {
  let taxService: TaxService;

  beforeEach(() => {
    taxService = new TaxService();
  });

  describe("getAvailableYears", () => {
    it("should return available tax years", () => {
      const years = taxService.getAvailableYears();
      expect(years).toEqual([
        "2022-2023",
        "2023-2024",
        "2024-2025",
        "2025-2026",
      ]);
    });
  });

  describe("calculateTax", () => {
    it("should calculate $0 tax for income below threshold", () => {
      expect(taxService.calculateTax("2023-2024", 18_000)).toBe(0);
      expect(taxService.calculateTax("2023-2024", 0)).toBe(0);
    });

    it("should calculate tax for second bracket (2023-2024)", () => {
      // $20,000: (20000 - 18201) * 0.19 = $341.81
      expect(taxService.calculateTax("2023-2024", 20_000)).toBe(341.81);
    });

    it("should calculate tax for third bracket (2023-2024)", () => {
      // $50,000: 5092 + (50000 - 45001) * 0.325 = $6716.68
      expect(taxService.calculateTax("2023-2024", 50_000)).toBe(6716.68);
    });

    it("should calculate tax for highest bracket (2023-2024)", () => {
      // $200,000: 51667 + (200000 - 180001) * 0.45 = $60666.55
      expect(taxService.calculateTax("2023-2024", 200_000)).toBe(60666.55);
    });

    it("should calculate different rates for 2024-2025", () => {
      // $20,000: (20000 - 18201) * 0.16 = $287.84
      expect(taxService.calculateTax("2024-2025", 20_000)).toBe(287.84);
      // $50,000: 4288 + (50000 - 45001) * 0.3 = $5787.7
      expect(taxService.calculateTax("2024-2025", 50_000)).toBe(5787.7);
    });

    it("should calculate correct rates for 2025-2026", () => {
      // $20,000: (20000 - 18200) * 0.16 = $288
      expect(taxService.calculateTax("2025-2026", 20_000)).toBe(288);
      // $50,000: 4288 + (50000 - 45001) * 0.3 = $5787.7
      expect(taxService.calculateTax("2025-2026", 50_000)).toBe(5787.7);
    });

    it("should calculate older rates for 2022-2023", () => {
      // Same brackets as 2023-2024
      expect(taxService.calculateTax("2022-2023", 20_000)).toBe(341.81);
      expect(taxService.calculateTax("2022-2023", 50_000)).toBe(6716.68);
    });

    it("should throw error for invalid year", () => {
      expect(() => taxService.calculateTax("invalid-year", 50_000)).toThrow(
        "Invalid tax year: invalid-year",
      );
    });

    it("should handle edge cases", () => {
      expect(taxService.calculateTax("2023-2024", 45_000)).toBe(5091.81); // Exactly at bracket boundary
      expect(taxService.calculateTax("2023-2024", 18_200)).toBe(0); // Tax-free threshold
    });
  });

  describe("calculateResult", () => {
    it("should return complete tax calculation result", () => {
      const result = taxService.calculateResult("2023-2024", 50_000);

      expect(result).toEqual({
        year: "2023-2024",
        income: 50_000,
        tax: 6716.68,
        afterTax: 43283.32,
        effectiveRate: 13.43336,
      });
    });

    it("should handle zero income", () => {
      const result = taxService.calculateResult("2023-2024", 0);

      expect(result.tax).toBe(0);
      expect(result.afterTax).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it("should calculate effective rate correctly", () => {
      const result = taxService.calculateResult("2023-2024", 100_000);
      const expectedEffectiveRate = (result.tax / result.income) * 100;

      expect(result.effectiveRate).toBeCloseTo(expectedEffectiveRate, 3);
    });

    it("should work with 2025-2026 rates", () => {
      const result = taxService.calculateResult("2025-2026", 50_000);

      expect(result.tax).toBe(5787.7);
      expect(result.afterTax).toBe(44212.3);
      expect(result.effectiveRate).toBe(11.5754);
    });
  });

  describe("validateYear", () => {
    it("should accept valid years", () => {
      const result = taxService.validateYear("2023-2024");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("2023-2024");
      }
    });

    it("should reject empty input", () => {
      const result = taxService.validateYear("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Year cannot be empty");
      }
    });

    it("should reject invalid format", () => {
      const result = taxService.validateYear("2023");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          "Year must be in format YYYY-YYYY (e.g., 2023-2024)",
        );
      }
    });

    it("should reject unavailable years", () => {
      const result = taxService.validateYear("2021-2022");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("2021-2022");
        expect(result.error).toContain(
          "2022-2023, 2023-2024, 2024-2025, 2025-2026",
        );
      }
    });
  });

  describe("validateIncome", () => {
    it("should accept valid numeric income", () => {
      const result = taxService.validateIncome("50000");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(50_000);
      }
    });

    it("should accept zero income", () => {
      const result = taxService.validateIncome("0");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0);
      }
    });

    it("should accept decimal income", () => {
      const result = taxService.validateIncome("50000.50");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(50_000.5);
      }
    });

    it("should reject empty input", () => {
      const result = taxService.validateIncome("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Income cannot be empty");
      }
    });

    it("should reject non-numeric input", () => {
      const result = taxService.validateIncome("abc");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Please enter a valid numeric income");
      }
    });

    it("should reject negative income", () => {
      const result = taxService.validateIncome("-1000");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Income cannot be negative");
      }
    });

    it("should reject income that is too large", () => {
      const result = taxService.validateIncome("1000000000");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Income exceeds maximum allowed value");
      }
    });

    it("should handle whitespace", () => {
      const result = taxService.validateIncome("  50000  ");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(50_000);
      }
    });
  });
});

describe("TaxCalculator", () => {
  let mockInput: IInputProvider;
  let mockOutput: IOutputProvider;
  let calculator: TaxCalculator;

  beforeEach(() => {
    mockInput = {
      prompt: vi.fn(),
    };

    mockOutput = {
      log: vi.fn(),
      showResult: vi.fn(),
    };

    calculator = new TaxCalculator(mockInput, mockOutput);
  });

  describe("getValidYear", () => {
    it("should return valid year on first try", async () => {
      vi.mocked(mockInput.prompt).mockResolvedValue("2023-2024");

      const year = await calculator.getValidYear();

      expect(year).toBe("2023-2024");
      expect(mockInput.prompt).toHaveBeenCalledWith(
        "Please enter the income year (e.g., 2023-2024): ",
      );
      expect(mockOutput.log).not.toHaveBeenCalled();
    });

    it("should retry until valid year is entered", async () => {
      vi.mocked(mockInput.prompt)
        .mockResolvedValueOnce("invalid-year")
        .mockResolvedValueOnce("2023-2024");

      const year = await calculator.getValidYear();

      expect(year).toBe("2023-2024");
      expect(mockInput.prompt).toHaveBeenCalledTimes(2);
      expect(mockOutput.log).toHaveBeenCalledWith(
        "Year must be in format YYYY-YYYY (e.g., 2023-2024)",
      );
    });
  });

  describe("getValidIncome", () => {
    it("should return valid income on first try", async () => {
      vi.mocked(mockInput.prompt).mockResolvedValue("50000");

      const income = await calculator.getValidIncome();

      expect(income).toBe(50_000);
      expect(mockInput.prompt).toHaveBeenCalledWith(
        "Please enter your total taxable income: $",
      );
      expect(mockOutput.log).not.toHaveBeenCalled();
    });

    it("should retry until valid income is entered", async () => {
      vi.mocked(mockInput.prompt)
        .mockResolvedValueOnce("abc")
        .mockResolvedValueOnce("-1000")
        .mockResolvedValueOnce("50000");

      const income = await calculator.getValidIncome();

      expect(income).toBe(50_000);
      expect(mockInput.prompt).toHaveBeenCalledTimes(3);
      expect(mockOutput.log).toHaveBeenCalledWith(
        "Please enter a valid numeric income",
      );
      expect(mockOutput.log).toHaveBeenCalledWith("Income cannot be negative");
    });
  });

  describe("run", () => {
    it("should complete full tax calculation flow", async () => {
      vi.mocked(mockInput.prompt)
        .mockResolvedValueOnce("2023-2024")
        .mockResolvedValueOnce("50000");

      const result = await calculator.run();

      expect(result).toEqual({
        year: "2023-2024",
        income: 50_000,
        tax: 6716.68,
        afterTax: 43283.32,
        effectiveRate: 13.43336,
      });
      expect(mockOutput.showResult).toHaveBeenCalledWith(result);
    });

    it("should handle validation errors gracefully", async () => {
      vi.mocked(mockInput.prompt)
        .mockResolvedValueOnce("invalid")
        .mockResolvedValueOnce("2023-2024")
        .mockResolvedValueOnce("abc")
        .mockResolvedValueOnce("50000");

      const result = await calculator.run();

      expect(result.income).toBe(50_000);
      expect(result.year).toBe("2023-2024");
      expect(mockOutput.log).toHaveBeenCalledTimes(2); // Two validation errors
    });
  });
});

describe("Integration Tests", () => {
  it("should calculate realistic tax scenarios", () => {
    const taxService = new TaxService();

    // Medium income
    expect(taxService.calculateTax("2023-2024", 80_000)).toBe(16466.68);
    expect(taxService.calculateTax("2024-2025", 80_000)).toBe(14787.7);
    expect(taxService.calculateTax("2025-2026", 80_000)).toBe(14787.7);

    // High income
    expect(taxService.calculateTax("2023-2024", 150_000)).toBe(40566.63);
    expect(taxService.calculateTax("2024-2025", 150_000)).toBe(36837.63);
    expect(taxService.calculateTax("2025-2026", 150_000)).toBe(36837.63);
  });

  it("should work with default providers", async () => {
    // This is more of a smoke test to ensure the class can be instantiated
    const calculator = new TaxCalculator();
    expect(calculator).toBeInstanceOf(TaxCalculator);
  });

  it("should demonstrate how class approach makes testing easier", () => {
    const taxService = new TaxService();

    const scenarios = [
      { year: "2023-2024", income: 30_000, expectedTax: 2241.81 },
      { year: "2023-2024", income: 60_000, expectedTax: 9966.67 },
      { year: "2024-2025", income: 30_000, expectedTax: 1887.84 },
      { year: "2024-2025", income: 60_000, expectedTax: 8787.7 },
      { year: "2025-2026", income: 30_000, expectedTax: 1888 },
      { year: "2025-2026", income: 60_000, expectedTax: 8787.7 },
    ];

    scenarios.forEach(({ year, income, expectedTax }) => {
      expect(taxService.calculateTax(year, income)).toBe(expectedTax);
    });
  });

  it("should allow easy mocking of TaxService for TaxCalculator tests", async () => {
    const mockTaxService = {
      validateYear: vi
        .fn()
        .mockReturnValue({ success: true, data: "2023-2024" }),
      validateIncome: vi.fn().mockReturnValue({ success: true, data: 50_000 }),
      calculateResult: vi.fn().mockReturnValue({
        year: "2023-2024",
        income: 50_000,
        tax: 6716.68,
        afterTax: 43283.32,
        effectiveRate: 13.43336,
      }),
    } as any;

    const mockInput = {
      prompt: vi
        .fn()
        .mockResolvedValueOnce("2023-2024")
        .mockResolvedValueOnce("50000"),
    };
    const mockOutput = { log: vi.fn(), showResult: vi.fn() };

    const calculator = new TaxCalculator(mockInput, mockOutput, mockTaxService);
    await calculator.run();

    expect(mockTaxService.calculateResult).toHaveBeenCalledWith(
      "2023-2024",
      50_000,
    );
    expect(mockOutput.showResult).toHaveBeenCalled();
  });

  it("should demonstrate class encapsulation benefits", () => {
    const taxService = new TaxService();

    const availableYears = taxService.getAvailableYears();
    const validation = taxService.validateYear(availableYears[0]!);

    if (validation.success) {
      const result = taxService.calculateResult(validation.data, 75_000);
      expect(result.year).toBe("2022-2023");
      expect(result.tax).toBeGreaterThan(0);
      expect(result.afterTax).toBeLessThan(75_000);
    }
  });
});
