import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

// LoginForm uses useSearchParams() to honor the `?next=` hint planted by the
// middleware. Next requires any component that reads search params in a
// statically-rendered route to be wrapped in Suspense, otherwise the build
// errors out with "missing-suspense-with-csr-bailout".
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
