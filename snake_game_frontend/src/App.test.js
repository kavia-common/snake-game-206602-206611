import { render, screen } from "@testing-library/react";
import App from "./App";

test("smoke: renders the Snake header and stats labels", () => {
  render(<App />);
  expect(screen.getByText("SNAKE")).toBeInTheDocument();
  expect(screen.getByText("Score")).toBeInTheDocument();
  expect(screen.getByText("High")).toBeInTheDocument();
});
