
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Lock } from "lucide-react";

const plans = [
  { id: 'monthly', title: 'Monthly', price: '99 SEK', period: '/Month', savings: null },
  { id: '3-months', title: '3 Months', price: '79 SEK', period: '/Month', savings: 'Save 20%' },
  { id: '6-months', title: '6 Months', price: '69 SEK', period: '/Month', savings: 'Save 30%' },
  { id: 'annual', title: 'Annual', price: '54 SEK', period: '/Month', savings: 'Save 45%' },
];

function CheckoutForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const planId = searchParams.get('plan');
    const selectedPlan = plans.find(p => p.id === planId) || plans[1];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        toast({
            title: "Payment Successful!",
            description: `Your subscription for the ${selectedPlan.title} plan is now active.`,
        });
        router.push('/dashboard');
    }

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 border rounded-lg">
                            <div>
                                <h3 className="font-semibold">{selectedPlan.title}</h3>
                                {selectedPlan.savings && <Badge variant="secondary">{selectedPlan.savings}</Badge>}
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold">{selectedPlan.price}</p>
                                <p className="text-sm text-muted-foreground">{selectedPlan.period}</p>
                            </div>
                        </div>
                        <div className="flex justify-between font-bold text-xl pt-4 border-t">
                            <span>Total</span>
                            <span>{selectedPlan.price.split(' ')[0]} SEK</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Payment Details</CardTitle>
                    <CardDescription>Enter your payment information to complete the purchase.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                             <Label>Payment Type</Label>
                             <RadioGroup defaultValue="subscription" className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="subscription" id="subscription" />
                                    <Label htmlFor="subscription">Auto-renewing</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="one-time" id="one-time" />
                                    <Label htmlFor="one-time">One-time payment</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="card-number">Card Number</Label>
                            <div className="relative">
                                <Input id="card-number" placeholder="0000 0000 0000 0000" required />
                                <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="expiry-date">Expiry Date</Label>
                                <Input id="expiry-date" placeholder="MM/YY" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cvc">CVC</Label>
                                <Input id="cvc" placeholder="123" required />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex-col items-stretch space-y-4">
                         <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" className="w-full" onClick={() => router.back()}>Go Back</Button>
                            <Button type="submit" className="w-full">Pay {selectedPlan.price.split(' ')[0]} SEK</Button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                           <Lock className="h-3 w-3" /> Secure payment processing.
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}


export default function CheckoutPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <div>
                <PageHeader 
                    title="Checkout"
                    description="You're one step away from unlocking your full potential."
                />
                <CheckoutForm />
            </div>
        </Suspense>
    )
}
