import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders Snake title", () => {
  render(<App />);
  expect(screen.getByText(/snake/i)).toBeInTheDocument();
});
