import { useHashRoute } from "./router";
import { Landing } from "./pages/Landing";
import { Docs } from "./pages/Docs";
import { AppPage } from "./pages/AppPage";
import { Toast, ToastCtx, useToastState } from "./views/ui";

export default function App() {
  const route = useHashRoute();
  const toast = useToastState();

  return (
    <ToastCtx.Provider value={toast}>
      <div className="shell">
        {route === "landing" && <Landing />}
        {route === "docs" && <Docs />}
        {route === "app" && <AppPage />}
        {toast.msg && <Toast msg={toast.msg} error={toast.isError} />}
      </div>
    </ToastCtx.Provider>
  );
}
