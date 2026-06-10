import * as React from "react";
import TransactionListAmountRangeFilter from "./TransactionListAmountRangeFilter";

describe("Transaction List Amount Range Filter", () => {
  it("should render the amount range chip with the default range", () => {
    cy.mount(
      <TransactionListAmountRangeFilter
        filterAmountRange={cy.spy()}
        amountRangeFilters={{}}
        resetAmountRange={cy.spy()}
      />
    );
    cy.get("[data-test='transaction-list-filter-amount-range-button']").should("contain", "Amount");
  });

  it("should render the extracted amount range filter when opened", () => {
    cy.mount(
      <TransactionListAmountRangeFilter
        filterAmountRange={cy.spy()}
        amountRangeFilters={{}}
        resetAmountRange={cy.spy()}
      />
    );
    cy.get("[data-test='transaction-list-filter-amount-range-button']").click();
    cy.get("[data-test='transaction-list-filter-amount-range']").should("be.visible");
    cy.get("[data-test='transaction-list-filter-amount-range-text']").should(
      "contain",
      "Amount Range"
    );
    cy.get("[data-test='transaction-list-filter-amount-range-slider']").should("exist");
  });

  it("should call resetAmountRange when the Clear button is clicked", () => {
    const resetAmountRangeSpy = cy.spy().as("resetAmountRange");
    cy.mount(
      <TransactionListAmountRangeFilter
        filterAmountRange={cy.spy()}
        amountRangeFilters={{}}
        resetAmountRange={resetAmountRangeSpy}
      />
    );
    cy.get("[data-test='transaction-list-filter-amount-range-button']").click();
    cy.get("[data-test='transaction-list-filter-amount-clear-button']").click();
    cy.get("@resetAmountRange").should("have.been.called");
  });
});
