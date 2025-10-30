'use client';

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import Link from 'next/link';

export default function TopBar() {
  return (
    <header className="sticky top-0 z-20 w-full border-none bg-transparent backdrop-blur-0 text-white">
      <Link href="/" className="flex h-14 items-center gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight focus:outline-none focus:ring-2 focus:ring-white rounded transition-colors hover:text-blue-200" aria-label="Go to homepage">15C Lab Project</Link>
        <NavigationMenu className="justify-start" viewport={false}>
          <NavigationMenuList className="justify-start">
            <NavigationMenuItem>
              <NavigationMenuLink href="/techniques" className="px-3 py-2">Techniques</NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="#" className="px-3 py-2">Explanations</NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </Link>
    </header>
  );
}


