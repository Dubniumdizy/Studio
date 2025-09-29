import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";
import Link from "next/link";

type QuickLink = {
  name: string;
  href: string;
  className: string;
}

const links: QuickLink[] = [
    { name: 'Spotify', href: 'https://spotify.com', className: 'bg-green-500/10 text-green-700 hover:bg-green-500/20' },
    { name: 'Wolfram Alpha', href: 'https://wolframalpha.com', className: 'bg-orange-500/10 text-orange-700 hover:bg-orange-500/20' },
    { name: 'YouTube', href: 'https://youtube.com', className: 'bg-red-500/10 text-red-700 hover:bg-red-500/20' },
    { name: 'Google', href: 'https://google.com', className: 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20' },
];

export function QuickLinksWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="w-5 h-5" />
          Quick Links
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
            {links.map(link => (
                <Button key={link.name} variant="ghost" className={link.className} asChild>
                    <Link href={link.href} target="_blank" rel="noopener noreferrer">{link.name}</Link>
                </Button>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
