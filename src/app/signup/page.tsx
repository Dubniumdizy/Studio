
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LeafIcon } from "@/components/icons/leaf-icon";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { validateEmail } from "@/lib/validation";

interface FormData {
  email: string;
  password: string;
  displayName: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  displayName?: string;
}

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading, signUp } = useAuth();

  const [formData, setFormData] = useState<FormData>({ email: "", password: "", displayName: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, redirect away
  useEffect(() => {
    if (user && !authLoading) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};

    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      nextErrors.email = emailValidation.error || "Invalid email";
    }

    if (!formData.password || formData.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters";
    }

    // Display name optional but if provided, trim
    if (formData.displayName && formData.displayName.trim().length === 0) {
      nextErrors.displayName = "Display name cannot be empty";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signUp(formData.email, formData.password, formData.displayName || undefined);
      toast({
        title: "Check your email",
        description: "We've sent you a confirmation link. Please verify your email, then log in.",
      });
      // After sign-up, send them to login so they can log in after confirming
      router.replace("/login");
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error?.message || "Unable to create your account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = formData.email.trim() && formData.password.trim() && !Object.keys(errors).length;

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-4">
            <LeafIcon className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold font-headline text-foreground">Studyverse</h1>
          </div>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Sign up to start growing your knowledge garden</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name (optional)</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="e.g. Alex"
                value={formData.displayName}
                onChange={(e) => handleInputChange("displayName", e.target.value)}
                disabled={authLoading || submitting}
                className={errors.displayName ? "border-red-500" : ""}
                aria-describedby={errors.displayName ? "displayName-error" : undefined}
              />
              {errors.displayName && (
                <p id="displayName-error" className="text-sm text-red-500">{errors.displayName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                disabled={authLoading || submitting}
                className={errors.email ? "border-red-500" : ""}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  disabled={authLoading || submitting}
                  className={errors.password ? "border-red-500 pr-10" : "pr-10"}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={authLoading || submitting}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting || !isFormValid}>
              {authLoading || submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Already have an account? {" "}
              <Link href="/login" className="text-primary hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
