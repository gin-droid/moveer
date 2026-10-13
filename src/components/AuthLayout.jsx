import React from "react";

/** @param {{icon?: React.ElementType, title: string, subtitle?: React.ReactNode, footer?: React.ReactNode, children?: React.ReactNode}} props */
export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-safe pb-safe pl-safe pr-safe">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img
            src={`${import.meta.env.BASE_URL}IMG_8121.JPG`}
            alt="moVeerAI — Analisi movimento, correzione postura e AI fitness"
            className="mx-auto mb-5 h-auto w-full max-w-[220px] object-contain object-center"
          />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <div className="text-center text-sm text-muted-foreground mt-6">{footer}</div>
        )}
      </div>
    </div>
  );
}