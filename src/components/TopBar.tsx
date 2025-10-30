export default function TopBar() {
  return (
    <header className="sticky top-0 z-20 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="flex h-14 items-center gap-6 px-4">
        <div className="font-semibold tracking-tight">15C Lab Project</div>
        <div className="flex items-center gap-4 text-sm text-foreground/80">
          <a href="#" className="hover:text-foreground transition-colors">Techniques</a>
          <a href="#" className="hover:text-foreground transition-colors">Explanations</a>
        </div>
      </nav>
    </header>
  );
}


