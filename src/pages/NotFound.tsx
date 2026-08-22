import { motion } from "framer-motion";
import { Link } from "react-router";
import { Home } from "lucide-react";
import logo from "@/assets/leads-logo.svg";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground"
    >
      <img src={logo} alt={`${BRAND.schoolName} logo`} width={64} height={64} className="mb-6 rounded-xl" />
      <p className="text-sm font-bold uppercase tracking-widest text-primary">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        This page doesn&apos;t exist in the {BRAND.schoolName} system.
      </p>
      <Button asChild className="mt-6 cursor-pointer">
        <Link to="/">
          <Home className="size-4" />
          Back to homepage
        </Link>
      </Button>
    </motion.div>
  );
}
