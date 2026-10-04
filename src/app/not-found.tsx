import { LinkButton } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

export default function NotFound() {
  return (
    <ErrorState
      code="404"
      title="We couldn't find that page"
      actions={
        <>
          <LinkButton href="/">Back to home</LinkButton>
          <LinkButton href="/portal/login" variant="secondary">
            Track an application
          </LinkButton>
        </>
      }
    >
      The page may have moved, or the link may be incomplete. If you were looking for an application, sign in to the portal to see it.
    </ErrorState>
  );
}
