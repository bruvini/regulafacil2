import { Menu, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  currentPage: string;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

const Header = ({ currentPage, onToggleSidebar, onLogout }: HeaderProps) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-header-bg border-b border-header-border">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left - Hamburger Menu */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="hover:bg-nav-hover"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Center - Page Title */}
        <h1 className="text-lg font-semibold text-foreground">
          {currentPage}
        </h1>

        {/* Right - User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 hover:bg-nav-hover">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Dr. João Silva</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem>
              <User className="h-4 w-4 mr-2" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;