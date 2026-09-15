import { StoreProvider, useStore } from "./lib/store";
import { ToastProvider, ConfirmProvider } from "./lib/ui";
import Home from "./screens/Home";
import Shell from "./screens/Shell";

function Root() {
  const { session } = useStore();
  return session ? <Shell key={session.festId + session.name} onExit={() => { /* session cleared — Home renders */ }} /> : <Home />;
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <ConfirmProvider>
          <Root />
        </ConfirmProvider>
      </ToastProvider>
    </StoreProvider>
  );
}
