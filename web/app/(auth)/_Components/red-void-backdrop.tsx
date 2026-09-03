export function RedVoidBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 isolate overflow-hidden"
    >
      <div className="auth-galaxy-base" />
      <div className="auth-cloud-layer auth-cloud-layer-back" />
      <div className="auth-cloud-layer auth-cloud-layer-mid" />
      <div className="auth-cloud-layer auth-cloud-layer-front" />
      <div className="auth-stars auth-stars-one" />
      <div className="auth-stars auth-stars-two" />
      <div className="auth-shooting-star auth-shooting-star-one" />
      <div className="auth-shooting-star auth-shooting-star-two" />
      <div className="auth-shooting-star auth-shooting-star-three" />
    </div>
  );
}
