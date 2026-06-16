import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AmountRangeFilter } from "../TransactionListAmountRangeFilter";

describe("AmountRangeFilter", () => {
  const defaultProps = {
    amountRangeValue: [25, 75],
    initialAmountRange: [0, 100],
    setAmountRangeValue: vi.fn(),
    resetAmountRange: vi.fn(),
    handleAmountRangeChange: vi.fn(),
  };

  it("should render the amount range text", () => {
    render(<AmountRangeFilter {...defaultProps} />);
    expect(screen.getByText(/Amount Range:/)).toBeInTheDocument();
  });

  it("should render the clear button", () => {
    render(<AmountRangeFilter {...defaultProps} />);
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("should reset amount range when clear button is clicked", () => {
    const setAmountRangeValue = vi.fn();
    const resetAmountRange = vi.fn();
    render(
      <AmountRangeFilter
        {...defaultProps}
        setAmountRangeValue={setAmountRangeValue}
        resetAmountRange={resetAmountRange}
      />
    );

    fireEvent.click(screen.getByText("Clear"));

    expect(setAmountRangeValue).toHaveBeenCalledWith([0, 100]);
    expect(resetAmountRange).toHaveBeenCalled();
  });

  it("should render the slider", () => {
    render(<AmountRangeFilter {...defaultProps} />);
    const sliders = screen.getAllByRole("slider");
    expect(sliders.length).toBeGreaterThanOrEqual(1);
  });
});
