import type { SVGProps } from "react";

export function LeafIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.5 17.0628C11.9433 18.2462 8.5 17.5 8.5 17.5C8.5 17.5 7.5 15.5 8 13C8.5 10.5 10.5 8.5 12.5 8C14.5 7.5 17 9 17.5 11.5C18 14 17.1195 15.8794 14.5 17.0628Z" />
      <path d="M8.5 17.5C8.5 17.5 5.75 16.5 5.5 11.5C5.25 6.5 12.5 2 12.5 2C12.5 2 19 4 20.5 9.5C22 15 17.5 19 17.5 19C17.5 19 14.5 17.0628 14.5 17.0628" />
    </svg>
  );
}
