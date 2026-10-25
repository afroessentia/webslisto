import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  rpc: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword: mocks.signInWithPassword }, rpc: mocks.rpc },
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/components/app-shell", () => ({ Logo: () => null }));

import { LoginPage } from "@/routes/login";

function submitLogin() {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "test@example.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("Default templates after login", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });
  afterEach(cleanup);

  it("calls the existing RPC once after successful login, not on rerender", async () => {
    const view = render(<LoginPage />);
    expect(mocks.rpc).not.toHaveBeenCalled();
    submitLogin();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/", replace: true }));
    view.rerender(<LoginPage />);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("ensure_default_templates");
    expect(mocks.signInWithPassword).toHaveBeenCalledExactlyOnceWith({ email: "test@example.com", password: "test-password" });
  });

  it("does not initialize templates when login fails", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: new Error("Invalid credentials") });
    render(<LoginPage />);
    submitLogin();
    await screen.findByText("E-mail ou senha incorretos.");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it.each(["response", "transport"])("silently ignores %s RPC errors and continues login", async (kind) => {
    if (kind === "response") mocks.rpc.mockResolvedValue({ error: new Error("RPC failed") });
    else mocks.rpc.mockRejectedValue(new Error("Network failed"));
    render(<LoginPage />);
    submitLogin();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/", replace: true }));
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("ensure_default_templates");
    expect(screen.queryByText("E-mail ou senha incorretos.")).not.toBeInTheDocument();
  });
});