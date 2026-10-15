"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, MessageSquare, Send, Star } from "lucide-react";
import { FormEvent, useState } from "react";
import type { ProductReview } from "@/lib/types";

function reviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function StaticStars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          className={star <= rating ? "fill-forge text-forge" : "text-zinc-700"}
          key={star}
          size={13}
        />
      ))}
    </span>
  );
}

export function ReviewSection({
  productId,
  productSlug,
  averageRating,
  reviewCount,
  reviews,
  signedIn
}: {
  productId: string;
  productSlug: string;
  averageRating: number;
  reviewCount: number;
  reviews: ProductReview[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const ownReview = reviews.find((review) => review.isOwn);
  const [rating, setRating] = useState(ownReview?.rating ?? 0);
  const [comment, setComment] = useState(ownReview?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating < 1) {
      setError("Choose a star rating first.");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, comment })
      });
      const data = await response.json() as { error?: string };
      if (response.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(`/product/${productSlug}#reviews`)}`);
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "Could not save your review.");
      setMessage(ownReview ? "Your review was updated." : "Thanks for your review.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your review.");
    } finally {
      setSubmitting(false);
    }
  }

  const shownAverage = reviewCount > 0 ? averageRating : 0;

  return (
    <section className="shell border-t border-line py-20" id="reviews">
      <div className="grid gap-8 lg:grid-cols-[.55fr_1.45fr]">
        <div>
          <p className="eyebrow">Community reviews</p>
          <h2 className="section-title mt-4">Used. Rated. Shared.</h2>
          <div className="mt-7 flex items-end gap-3">
            <b className="text-5xl tracking-[-0.06em]">{shownAverage.toFixed(1)}</b>
            <div className="pb-1">
              <StaticStars rating={Math.round(shownAverage)} />
              <p className="mt-1 text-[0.62rem] text-zinc-600">{reviewCount.toLocaleString("en-US")} {reviewCount === 1 ? "review" : "reviews"}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-xl border border-line bg-panel p-5 sm:p-6">
            {signedIn ? (
              <form onSubmit={submitReview}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold">{ownReview ? "Update your review" : "Review this add-on"}</p>
                    <p className="mt-1 text-[0.62rem] text-zinc-600">One review per account. You can update it anytime.</p>
                  </div>
                  <div aria-label="Choose a rating" className="flex gap-1" role="group">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        aria-label={`${star} star${star === 1 ? "" : "s"}`}
                        className="rounded p-1 transition hover:scale-110 disabled:opacity-50"
                        disabled={submitting}
                        key={star}
                        onClick={() => setRating(star)}
                        type="button"
                      >
                        <Star className={star <= rating ? "fill-forge text-forge" : "text-zinc-700"} size={22} />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  className="field mt-4 min-h-28 resize-y"
                  maxLength={2000}
                  minLength={3}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Share what worked well, your workflow, or a helpful tip..."
                  required
                  value={comment}
                />
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div aria-live="polite">
                    {error && <p className="text-xs text-red-300">{error}</p>}
                    {message && <p className="text-xs text-emerald-300">{message}</p>}
                  </div>
                  <button className="button-primary sm:ml-auto" disabled={submitting} type="submit">
                    {submitting ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}
                    {submitting ? "Saving..." : ownReview ? "Update review" : "Post review"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold">Share your experience</p>
                  <p className="mt-1 text-xs text-zinc-600">Sign in before posting a comment and star rating.</p>
                </div>
                <Link className="button-primary" href={`/auth?next=${encodeURIComponent(`/product/${productSlug}#reviews`)}`}>
                  Sign in to review
                </Link>
              </div>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-12 text-center">
              <MessageSquare className="mx-auto text-zinc-700" size={27} strokeWidth={1.3} />
              <p className="mt-3 text-sm font-semibold text-zinc-500">No reviews yet. Be the first to share one.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {reviews.map((review) => (
                <article className="rounded-xl border border-line bg-panel/65 p-5" key={review.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <b className="text-xs text-zinc-300">{review.authorName}</b>
                      {review.isOwn && <span className="rounded bg-forge/10 px-1.5 py-0.5 text-[0.52rem] font-bold uppercase text-forge-soft">You</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <StaticStars rating={review.rating} />
                      <time className="text-[0.58rem] text-zinc-700" dateTime={review.createdAt}>{reviewDate(review.createdAt)}</time>
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-500">{review.comment}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
