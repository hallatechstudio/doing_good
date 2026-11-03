import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const contactEmail = "support@bethereexperience.com";
const updated = "3 November 2026";

function Contact() {
  return (
    <a className="text-primary underline underline-offset-4" href={`mailto:${contactEmail}`}>
      {contactEmail}
    </a>
  );
}

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
      <title>{title} | DoingGood</title>
      <p className="eyebrow text-primary">DoingGood Initiative</p>
      <h1 className="section-title mt-4">{title}</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated: {updated}</p>
      <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
      <nav
        aria-label="Legal pages"
        className="mt-12 flex flex-wrap gap-6 border-t border-border pt-6 text-sm"
      >
        <Link className="text-primary hover:underline" to="/privacy">
          Privacy Policy
        </Link>
        <Link className="text-primary hover:underline" to="/terms">
          Terms of Use
        </Link>
      </nav>
    </article>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        DoingGood Initiative ("DoingGood", "we", "us") operates this platform for giving and finding
        free and paid items in Lagos, Nigeria. This policy explains how we handle personal data when
        you browse, create an account, list items or contact us. For privacy questions or requests,
        email <Contact />.
      </p>
      <section>
        <h2>1. Information we collect</h2>
        <ul>
          <li>
            Account details: your name, email address, WhatsApp number and account creation date.
          </li>
          <li>
            Security information: a password hash, session records and password reset records. We do
            not store your password as readable text.
          </li>
          <li>
            Listing information: item titles, descriptions, categories, condition, neighbourhood,
            photographs and availability.
          </li>
          <li>Support information you send us, such as questions, reports or data requests.</li>
          <li>
            Membership expiry, payment references, amounts, order status, delivery reports, disputes
            and review outcomes. Seller payout setup stores a verified account name and recipient
            token; bank details are sent to the payment processor for verification. Payment card
            details are entered with the processor, not stored by DoingGood.
          </li>
          <li>
            Technical information processed to operate and protect the service, including IP
            addresses, request details and hosting logs.
          </li>
        </ul>
        <p>
          Do not upload identity documents, precise home addresses, financial details or other
          people's personal information in listings or photos.
        </p>
      </section>
      <section>
        <h2>2. Why we use your information</h2>
        <p>
          We use account and listing information to provide the service you request: creating
          accounts, signing you in, publishing listings, enabling donor contact, updating your
          profile, managing memberships, verifying payments, arranging seller payouts and refunds,
          reviewing disputes, and sending password reset and delivery-review emails. Payment
          processors receive the details needed to handle payments and verify bank accounts. We also
          use necessary technical and support data to prevent abuse, troubleshoot problems and
          respond to enquiries.
        </p>
        <p>
          Our legal bases include performing our agreement with you, legitimate interests in
          operating and securing the service where these do not override your rights, and compliance
          with applicable legal obligations. Where an activity requires consent, we will request it
          separately. Reading this notice does not itself give consent.
        </p>
      </section>
      <section>
        <h2>3. What other people can see</h2>
        <p>
          Listings, photographs, your donor name and the neighbourhood you provide can be viewed
          without an account. Donor WhatsApp numbers for free items are available to signed-in
          members when membership access is active. For paid orders, contact details are shared with
          the buyer and seller after payment. Authorised support staff can review order and dispute
          information to resolve problems. Your email address and password hash are not included in
          public listing responses. Information you publish may be copied or shared by others.
        </p>
      </section>
      <section>
        <h2>4. WhatsApp conversations</h2>
        <p>
          Contacting a donor opens WhatsApp with their number and a suggested message about the
          item. WhatsApp processes information under its own privacy terms. DoingGood does not
          receive or store the contents of those conversations. Your WhatsApp identity and any
          details you send are shared with the person you contact; choose carefully what you
          disclose.
        </p>
      </section>
      <section>
        <h2>5. Cookies</h2>
        <p>
          We use an essential sign-in cookie to recognise your session. It expires after up to 30
          days, and signing out clears it from your browser. You can delete or block cookies in your
          browser, but account features will then be affected. The current application does not
          include advertising cookies or analytics trackers.
        </p>
      </section>
      <section>
        <h2>6. Retention and security</h2>
        <p>
          We keep account and listing data while needed to provide the service, address disputes or
          meet legal obligations. You can request account and listing deletion by email. Marking an
          item as given changes its availability; it does not delete its record or photographs. Any
          information that must be retained for a legal or security reason will be limited to that
          purpose. Provider backups and logs may remain until their normal retention periods end.
        </p>
        <p>
          Password hashing, protected session cookies and access controls help protect your
          information. No online service can guarantee complete security. Keep your password private
          and contact us if you suspect unauthorised access.
        </p>
      </section>
      <section>
        <h2>7. Your privacy rights</h2>
        <p>
          Subject to applicable law, you may request access, correction, deletion, restriction,
          portability or object to processing, and withdraw consent where processing relies on it.
          Email <Contact /> with your request. We may need proportionate information to verify your
          identity. You can also complain directly to the{" "}
          <a className="text-primary underline underline-offset-4" href="https://ndpc.gov.ng/">
            Nigeria Data Protection Commission
          </a>
          . Our handling of these requests is subject to the Nigeria Data Protection Act 2023.
        </p>
      </section>
      <section>
        <h2>8. Children and changes to this policy</h2>
        <p>
          Accounts are intended for people aged 18 or older. If you believe a child has provided
          personal data, contact us so we can investigate and address it. We may update this policy
          as the service changes and will display the revised date here. Where required, we will
          provide additional notice or seek consent for a new use of your information.
        </p>
      </section>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p>
        These terms cover your use of DoingGood, operated by DoingGood Initiative. By creating an
        account or using the platform, you agree to these terms. If you do not agree, please stop
        using the service. Questions and reports can be sent to <Contact />.
      </p>
      <section>
        <h2>1. What DoingGood provides</h2>
        <p>
          DoingGood helps people give, sell and find items across Lagos. We provide listings,
          membership access to request free items and, when enabled, paid checkout and order
          management. We do not own or inspect listed items, verify every user or book deliveries. A
          listing, payment or membership does not guarantee a match or availability.
        </p>
      </section>
      <section>
        <h2>2. Accounts</h2>
        <p>
          You must be at least 18 and able to enter an agreement to create an account. Provide
          accurate details, use an email address and WhatsApp number you control, keep your password
          secure and tell us about suspected account misuse. Do not impersonate anyone or use
          someone else's account without permission. Browsing is available without an account;
          listing and contacting donors require sign-in.
        </p>
      </section>
      <section>
        <h2>3. Listing and requesting items</h2>
        <p>
          Only offer items you own or are authorised to give away. Describe their condition, defects
          and safety concerns honestly, use accurate photos and keep availability up to date. Items
          may be free or paid. Sellers set a clear price in naira before listing; that price is the
          item total shown at checkout. A free listing must not carry an item price, deposit or
          reservation fee. Listing is free. Request items honestly and treat donors and other users
          respectfully. Donors choose whom to give to; requesting first does not create an
          entitlement to an item.
        </p>
      </section>
      <section>
        <h2>4. Prohibited items and conduct</h2>
        <p>
          Do not list stolen or counterfeit goods, weapons, illegal substances, prescription
          medicines, recalled or unsafe products, hazardous materials or anything unlawful to
          transfer. Do not use the platform for fraud, harassment, discrimination, sexual content,
          unsolicited marketing, collecting other users' contact details for unrelated purposes,
          unauthorised scraping or interference with the service. Do not publish private information
          or content you do not have permission to share.
        </p>
      </section>
      <section>
        <h2>5. Contact, collection and safety</h2>
        <p>
          Users arrange collection or delivery directly on WhatsApp, including the location, timing
          and any genuine delivery costs. Agree on these before proceeding. DoingGood does not
          handle delivery payments or guarantee a courier. Check the item and the person's details,
          choose a safe meeting place and share only the personal information needed for the
          exchange. Never share passwords or verification codes with another user.
        </p>
        <p>
          For a paid order, report a delivery problem using Open dispute in Orders before the review
          deadline; a WhatsApp message alone does not pause payout. Report suspected abuse to us
          with relevant listing details; contact the appropriate authorities for emergencies or
          suspected crime.
        </p>
      </section>
      <section>
        <h2>6. Membership, payment and delivery review</h2>
        <p>
          Membership costs ₦20,000 for 30 days and provides access to request free items. It does
          not guarantee any item, donor approval, a particular number of matches or delivery.
          Renewal is manual; we do not charge automatically. Early renewal adds 30 days to your
          current expiry. Paid items have a separate price and do not require membership. Any
          temporary free-access period before membership payments launch will be shown in the app.
        </p>
        <p>
          Paid checkout is available only when the payment arrangement is configured. A verified
          item payment is not paid out immediately to the seller. After receiving and checking the
          item, the buyer may confirm receipt in Orders to authorise payout. Do not confirm merely
          because a seller asks you to.
        </p>
        <p>
          When a seller reports delivery and the delivery-review email is successfully sent, a
          24-hour review period starts. If the buyer does not open a dispute within that window, the
          order becomes eligible for automatic payout. Actual payment processing may take longer. If
          an email cannot be sent, the automatic release clock does not start. A buyer's explicit
          confirmation can authorise release sooner.
        </p>
        <p>
          A dispute freezes the automatic release deadline until an authorised administrator reviews
          the evidence and records a decision to pay the seller or refund the buyer. Disputed orders
          do not automatically release after 24 hours. Submit accurate evidence and cooperate with
          reasonable review requests. Refunds are complete only when confirmed by the payment
          processor; bank processing times vary. Contact support if a payout or refund needs review.
        </p>
        <p>
          The platform currently adds no commission to an item price. Listing prices do not include
          separately agreed delivery costs. Do not send a direct item payment to a seller:
          off-platform payments do not have DoingGood's release controls. Before purchasing, resolve
          any questions about delivery arrangements with support. Mandatory consumer, chargeback and
          data protection rights remain unaffected.
        </p>
        <p>
          For a missing, misdescribed or undelivered paid item, open a dispute promptly. For
          accidental membership purchases or access problems, contact support with your payment
          reference; we will review the circumstances and any applicable refund rights. Membership
          fees are not treated as a deposit for a particular item.
        </p>
      </section>
      <section>
        <h2>7. Your content and personal data</h2>
        <p>
          You retain ownership of content you upload. You grant DoingGood a non-exclusive,
          royalty-free licence to store, reproduce and display it as needed to operate and promote
          its availability on the platform. You are responsible for obtaining any permissions needed
          for photographs and descriptions. This licence does not transfer ownership to us. Our{" "}
          <Link className="text-primary underline underline-offset-4" to="/privacy">
            Privacy Policy
          </Link>{" "}
          explains how we handle personal data and deletion requests.
        </p>
      </section>
      <section>
        <h2>8. Moderation, suspension and leaving</h2>
        <p>
          We may remove listings or restrict accounts where reasonably necessary to address breaches
          of these terms, fraud, safety concerns or legal requirements. Where appropriate, we will
          explain the reason; contact us if you believe a decision is mistaken. You may stop using
          DoingGood at any time and email us to request account closure or deletion.
        </p>
      </section>
      <section>
        <h2>9. Availability and responsibility</h2>
        <p>
          We aim to keep DoingGood useful and available but cannot guarantee uninterrupted access,
          accurate user content, the condition of an item or another user's conduct. To the extent
          permitted by law, we are not responsible for losses caused by independent users, item
          exchanges, delivery arrangements or third-party services. Nothing in these terms excludes
          liability or rights that cannot lawfully be excluded, including applicable consumer and
          data protection rights.
        </p>
      </section>
      <section>
        <h2>10. Changes and governing law</h2>
        <p>
          We may change the service and these terms, posting the updated terms and revision date
          here. We will give reasonable notice of material changes where practicable. If you do not
          agree with updated terms, stop using the service and contact us about closing your
          account. Nigerian law governs these terms, subject to mandatory rights that apply to you.
          Unresolved disputes may be brought before a court with appropriate jurisdiction.
        </p>
      </section>
    </LegalPage>
  );
}
