import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-page py-20 text-center max-w-xl">
      <p className="kicker mb-3">404</p>
      <h1 className="text-4xl font-semibold mb-3">Page not found</h1>
      <p className="muted mb-6">The page you’re looking for doesn’t exist or may have been moved.</p>
      <Link href="/" className="btn btn-primary">Back home</Link>
    </div>
  );
}
