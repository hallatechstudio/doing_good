import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/whatsapp-icon";

export function ContactPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-16 sm:px-6">
      <title>Contact | DoingGood</title>
      <p className="eyebrow">SUPPORT</p>
      <h1 className="section-title">We are here to help.</h1>
      <p className="max-w-xl text-muted-foreground">
        For a paid-order dispute, include the item name and explain what happened. We keep disputes
        in email so there is a clear record.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="hero">
          <a href="mailto:support@hallatechnologies.com">Email support</a>
        </Button>
        <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
          <a href="https://wa.me/" target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon className="size-5" />
            WhatsApp
          </a>
        </Button>
      </div>
    </main>
  );
}
