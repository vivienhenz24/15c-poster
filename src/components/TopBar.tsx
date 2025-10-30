'use client';

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-20 w-full border-none bg-transparent backdrop-blur-0">
      <nav className="flex h-14 items-center gap-4 px-4">
        <div className="font-semibold tracking-tight">15C Lab Project</div>
        <NavigationMenu className="justify-start" viewport={false}>
          <NavigationMenuList className="justify-start">
            <NavigationMenuItem>
              <NavigationMenuLink href="#" className="px-3 py-2">Techniques</NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="#" className="px-3 py-2">Explanations</NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </nav>
    </header>
  );
}


