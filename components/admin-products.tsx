"use client";

import {
  FileArchive,
  ImagePlus,
  Link2,
  LoaderCircle,
  PackagePlus,
  Pencil,
  Search,
  Send,
  Trash2,
  Video,
  X
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminActionButton } from "@/components/admin-shell";
import { EditorDialog } from "@/components/editor-dialog";
import type { AdminProductRow } from "@/lib/admin-data";
import { VIDEO_CHUNK_BYTES, vpsVideoUrl } from "@/lib/video-path";

type SignedUpload = {
  provider?: "vps";
  signedUrl: string;
  token: string;
  path: string;
};

type PreparationResponse = {
  productId?: string;
  versionId?: string;
  upload?: SignedUpload;
  path?: string;
  uploads?: {
    archive?: SignedUpload;
    cover?: SignedUpload | null;
    tutorialVideo?: SignedUpload | null;
  };
  error?: string;
};

type EditorState =
  | { mode: "create"; product: null }
  | { mode: "edit"; product: AdminProductRow };

function formatUsd(cents: number) {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function publicMediaUrl(path: string) {
  if (path.startsWith("vps:")) return vpsVideoUrl(path) ?? "";
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return "";
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-media/${encodedPath}`;
}

function statusClass(status: AdminProductRow["status"]) {
  if (status === "PUBLISHED") return "bg-emerald-500/10 text-emerald-400";
  if (status === "DRAFT") return "bg-amber-500/10 text-amber-400";
  return "bg-zinc-500/10 text-zinc-500";
}

async function jsonBody<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}

async function uploadSignedFile(upload: SignedUpload, file: File, cacheControl: string) {
  if (upload.provider === "vps") {
    let offset = 0;
    while (offset < file.size) {
      const end = Math.min(offset + VIDEO_CHUNK_BYTES, file.size);
      let nextOffset = offset;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(upload.signedUrl, {
            method: "PUT",
            headers: { "authorization": `Bearer ${upload.token}`, "content-type": "application/octet-stream", "x-upload-offset": String(offset) },
            body: file.slice(offset, end)
          });
          const result = await jsonBody<{ error?: string; offset?: number }>(response);
          if (!response.ok) {
            if (response.status < 500 && response.status !== 409) throw new Error(result.error ?? `Upload failed with status ${response.status}.`, { cause: "permanent" });
            throw new Error(result.error ?? `Upload failed with status ${response.status}.`);
          }
          if (!Number.isSafeInteger(result.offset) || result.offset! < end || result.offset! > file.size) throw new Error("Invalid upload response.");
          nextOffset = result.offset!;
          break;
        } catch (error) {
          if (attempt === 2 || (error instanceof Error && error.cause === "permanent")) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      offset = nextOffset;
    }
    return;
  }
  const body = new FormData();
  body.append("cacheControl", cacheControl);
  body.append("", file);
  const response = await fetch(upload.signedUrl, {
    method: "PUT",
    headers: { "x-upsert": "false" },
    body
  });
  if (!response.ok) {
    const details = await jsonBody<{ message?: string; error?: string }>(response);
    const reason = details.message ?? details.error;
    throw new Error(`Upload failed with status ${response.status}${reason ? `: ${reason}` : "."}`);
  }
}

function selectedFile(form: FormData, name: string) {
  const value = form.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

function selectedFiles(form: FormData, name: string) {
  return form
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function fileMetadata(file: File) {
  return {
    name: file.name,
    size: file.size,
    contentType: file.type || "application/octet-stream"
  };
}

function productPayload(form: FormData) {
  const blenderVersions = Array.from(new Set(
    String(form.get("blenderVersions"))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  ));
  const features = Array.from(new Set(
    String(form.get("features"))
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)
  ));
  if (blenderVersions.length === 0) {
    throw new Error("Enter at least one supported Blender version.");
  }
  if (features.length === 0) {
    throw new Error("Enter at least one key feature.");
  }

  const paid = form.get("pricing") === "paid";
  const price = Number(form.get("usdPrice"));
  if (paid && (!Number.isFinite(price) || price <= 0)) {
    throw new Error("Enter a paid USD price greater than zero.");
  }

  const tutorialUrl = String(form.get("tutorialUrl") ?? "").trim();
  const tutorialLabel = String(form.get("tutorialLabel") ?? "").trim();
  return {
    title: form.get("title"),
    slug: form.get("slug"),
    category: form.get("category"),
    eyebrow: form.get("eyebrow"),
    description: form.get("description"),
    longDescription: form.get("longDescription"),
    guide: form.get("guide"),
    features,
    blenderVersions,
    usdAmountCents: paid ? Math.round(price * 100) : 0,
    requiresLogin: paid || form.get("requiresLogin") === "on",
    tutorialUrl: tutorialUrl || null,
    tutorialLabel: tutorialLabel || null
  };
}

export function AdminProducts({
  products,
  error: loadError
}: {
  products: AdminProductRow[];
  error: string | null;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorPricing, setEditorPricing] = useState<"free" | "paid">("free");
  const [versionEditor, setVersionEditor] = useState<AdminProductRow | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | AdminProductRow["status"]>("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesStatus = status === "ALL" || product.status === status;
      const haystack = `${product.title} ${product.slug} ${product.category} ${product.version ?? ""}`.toLowerCase();
      return matchesStatus && haystack.includes(needle);
    });
  }, [products, query, status]);

  async function finalize(productId: string, versionId: string) {
    const response = await fetch(`/api/admin/products/${productId}/finalize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ versionId })
    });
    const data = await jsonBody<{ error?: string }>(response);
    if (!response.ok) throw new Error(data.error ?? "Unable to publish this add-on.");
  }

  async function prepareAsset(productId: string, kind: "image" | "tutorialVideo", file: File) {
    const response = await fetch(`/api/admin/products/${productId}/assets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, file: fileMetadata(file) })
    });
    const data = await jsonBody<PreparationResponse>(response);
    if (!response.ok || !data.upload || !data.path) {
      throw new Error(data.error ?? "Unable to prepare the asset upload.");
    }
    await uploadSignedFile(data.upload, file, "31536000");
    return data.path;
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const archive = selectedFile(form, "archive");
    const images = selectedFiles(form, "images");
    const tutorialVideo = selectedFile(form, "tutorialVideo");
    if (images.length > 20) {
      setError("Choose no more than 20 gallery images.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    let createdProductId: string | null = null;
    try {
      const metadata = productPayload(form);
      if (editor.mode === "create") {
        if (!archive) throw new Error("Choose the required add-on ZIP archive.");
        const response = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...metadata,
            version: form.get("version"),
            changelog: form.get("changelog"),
            archive: fileMetadata(archive),
            cover: images[0] ? fileMetadata(images[0]) : null,
            tutorialVideo: tutorialVideo ? fileMetadata(tutorialVideo) : null
          })
        });
        const preparation = await jsonBody<PreparationResponse>(response);
        if (
          !response.ok
          || !preparation.productId
          || !preparation.versionId
          || !preparation.uploads?.archive
        ) {
          throw new Error(preparation.error ?? "Unable to prepare this add-on.");
        }
        createdProductId = preparation.productId;
        await uploadSignedFile(preparation.uploads.archive, archive, "3600");
        const mediaPaths: string[] = [];
        if (images[0] && preparation.uploads.cover) {
          await uploadSignedFile(preparation.uploads.cover, images[0], "31536000");
          mediaPaths.push(preparation.uploads.cover.path);
        }
        if (tutorialVideo && preparation.uploads.tutorialVideo) {
          await uploadSignedFile(preparation.uploads.tutorialVideo, tutorialVideo, "31536000");
        }
        for (const image of images.slice(1)) {
          mediaPaths.push(await prepareAsset(preparation.productId, "image", image));
        }
        if (mediaPaths.length > 1) {
          const mediaResponse = await fetch(`/api/admin/products/${preparation.productId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...metadata, mediaPaths })
          });
          const mediaData = await jsonBody<{ error?: string }>(mediaResponse);
          if (!mediaResponse.ok) {
            throw new Error(mediaData.error ?? "Unable to save the gallery images.");
          }
        }
        await finalize(preparation.productId, preparation.versionId);
        setMessage(`${String(form.get("title"))} is published.`);
      } else {
        const productId = editor.product.id;
        const removedMediaPaths = new Set(
          form.getAll("removeMediaPath").map(String)
        );
        const retainedMediaPaths = editor.product.mediaPaths.filter(
          (path) => !removedMediaPaths.has(path)
        );
        if (retainedMediaPaths.length + images.length > 20) {
          throw new Error("A gallery can contain up to 20 images.");
        }
        const addedMediaPaths: string[] = [];
        for (const image of images) {
          addedMediaPaths.push(await prepareAsset(productId, "image", image));
        }
        const mediaChanged = removedMediaPaths.size > 0 || addedMediaPaths.length > 0;
        const mediaPaths = mediaChanged
          ? [...retainedMediaPaths, ...addedMediaPaths]
          : undefined;
        const tutorialVideoPath = tutorialVideo
          ? await prepareAsset(productId, "tutorialVideo", tutorialVideo)
          : form.get("removeTutorialVideo") === "on" ? null : undefined;
        const response = await fetch(`/api/admin/products/${productId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...metadata,
            ...(mediaPaths !== undefined ? { mediaPaths } : {}),
            ...(tutorialVideoPath !== undefined ? { tutorialVideoPath } : {})
          })
        });
        const data = await jsonBody<{ error?: string }>(response);
        if (!response.ok) throw new Error(data.error ?? "Unable to update this add-on.");
        setMessage(`${String(form.get("title"))} was updated.`);
      }

      formElement.reset();
      setEditor(null);
      router.refresh();
    } catch (caught) {
      if (createdProductId) {
        await fetch(`/api/admin/products/${createdProductId}`, { method: "DELETE" }).catch(() => undefined);
      }
      setError(caught instanceof Error ? caught.message : "Unable to save this add-on.");
    } finally {
      setSubmitting(false);
    }
  }

  async function addVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!versionEditor) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const archive = selectedFile(form, "archive");
    if (!archive) {
      setError("Choose the required add-on ZIP archive.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    let versionId: string | null = null;
    try {
      const response = await fetch(`/api/admin/products/${versionEditor.id}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: form.get("version"),
          changelog: form.get("changelog"),
          archive: fileMetadata(archive)
        })
      });
      const preparation = await jsonBody<PreparationResponse>(response);
      if (!response.ok || !preparation.versionId || !preparation.upload) {
        throw new Error(preparation.error ?? "Unable to prepare the new version.");
      }
      versionId = preparation.versionId;
      await uploadSignedFile(preparation.upload, archive, "3600");
      await finalize(versionEditor.id, preparation.versionId);
      setMessage(`${versionEditor.title} v${String(form.get("version"))} is published.`);
      setVersionEditor(null);
      formElement.reset();
      router.refresh();
    } catch (caught) {
      if (versionId) {
        await fetch(`/api/admin/products/${versionEditor.id}/versions`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ versionId })
        }).catch(() => undefined);
      }
      setError(caught instanceof Error ? caught.message : "Unable to publish the new version.");
    } finally {
      setSubmitting(false);
    }
  }

  async function publishDraft(product: AdminProductRow) {
    if (!product.versionId) return;
    setPublishingId(product.id);
    setError(null);
    setMessage(null);
    try {
      await finalize(product.id, product.versionId);
      setMessage(`${product.title} is published.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to publish this add-on.");
    } finally {
      setPublishingId(null);
    }
  }

  async function removeDraft(product: AdminProductRow) {
    if (!window.confirm(`Remove the incomplete draft "${product.title}" and its uploaded files?`)) return;
    setDeletingId(product.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      const data = await jsonBody<{ error?: string; warning?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Unable to remove this draft.");
      setMessage(`${product.title} draft was removed.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove this draft.");
    } finally {
      setDeletingId(null);
    }
  }

  function openCreateEditor() {
    setError(null);
    setEditorPricing("free");
    setEditor({ mode: "create", product: null });
  }

  function openEditEditor(product: AdminProductRow) {
    setError(null);
    setEditorPricing(product.isFree ? "free" : "paid");
    setEditor({ mode: "edit", product });
  }

  const editingProduct = editor?.mode === "edit" ? editor.product : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-panel p-5">
        <div><h2 className="text-lg font-bold">Your add-ons</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Edit changes the product page. Add version uploads an updated ZIP for customers.</p></div>
        <AdminActionButton disabled={submitting} onClick={openCreateEditor}>
          Create add-on
        </AdminActionButton>
      </div>
      {(loadError || error) && (
        <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs leading-5 text-red-300">
          {error ?? `Products could not be fully loaded. ${loadError}`}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs text-emerald-300">
          {message}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
            <input aria-label="Search your add-ons" type="search" className="field !pl-9 text-sm" placeholder="Search name, category, or version" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="flex gap-2">
            <select aria-label="Filter by publishing status" className="field !w-auto text-sm" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="ALL">All statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            {(query || status !== "ALL") && <button type="button" className="button-ghost" onClick={() => { setQuery(""); setStatus("ALL"); }}>Clear filters</button>}
          </div>
        </div>

        <div className="border-b border-line px-4 py-3 text-sm text-zinc-400" role="status">{filtered.length} of {products.length} add-ons · Published: visible in store · Draft: not yet published · Archived: removed from store</div>
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <PackagePlus className="mx-auto text-zinc-700" size={32} strokeWidth={1.3} />
            <p className="mt-4 text-sm font-semibold text-zinc-400">{products.length === 0 ? "No add-ons yet." : "No matching add-ons."}</p>
            <p className="mt-2 text-sm text-zinc-400">{products.length === 0 ? "Have your ZIP file, description, and Blender compatibility ready, then select Create add-on." : "Try a different search or clear your filters."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-product-table w-full text-left">
              <thead className="bg-ink/45 text-[0.56rem] uppercase tracking-wider text-zinc-600">
                <tr>{["Add-on", "Status", "Price", "Login", "Version", "Downloads", "Updated", "Actions"].map((head) => <th className="px-4 py-3 font-bold" key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((product) => (
                  <tr className="text-xs hover:bg-white/[0.02]" key={product.id}>
                    <td data-label="Add-on" className="px-4 py-3.5"><p className="font-semibold">{product.title}</p><p className="mt-1 text-[0.58rem] text-zinc-600">/{product.slug} - {product.category}</p></td>
                    <td data-label="Status" className="px-4 py-3.5"><span className={`rounded px-2 py-1 text-[0.54rem] font-bold uppercase ${statusClass(product.status)}`}>{product.status}</span></td>
                    <td data-label="Price" className="px-4 py-3.5 font-mono text-zinc-400">{formatUsd(product.usdAmountCents)}</td>
                    <td data-label="Sign-in" className="px-4 py-3.5 text-zinc-500">{product.requiresLogin ? "Required" : "Not required"}</td>
                    <td data-label="Version" className="px-4 py-3.5 text-zinc-500">{product.version ? `v${product.version}` : "None"} <span className="text-zinc-700">({product.versionCount})</span></td>
                    <td data-label="Downloads" className="px-4 py-3.5 text-zinc-500">{product.downloadCount.toLocaleString("en-US")}</td>
                    <td data-label="Updated" className="px-4 py-3.5 text-zinc-600">{formatDate(product.updatedAt)}</td>
                    <td data-label="Actions" className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button className="button-secondary !min-h-8 !px-2.5 text-[0.62rem]" onClick={() => openEditEditor(product)} type="button"><Pencil size={12} /> Edit</button>
                        <button className="button-secondary !min-h-8 !px-2.5 text-[0.62rem]" disabled={product.status === "ARCHIVED"} onClick={() => { setError(null); setVersionEditor(product); }} type="button"><PackagePlus size={12} /> Add version</button>
                        {product.status === "DRAFT" && (
                          <>
                            <button className="button-secondary !min-h-8 !px-2.5 text-[0.62rem]" disabled={!product.versionId || publishingId === product.id} onClick={() => publishDraft(product)} type="button">
                              {publishingId === product.id ? <LoaderCircle className="animate-spin" size={12} /> : <Send size={12} />} Publish
                            </button>
                            <button className="button-ghost !min-h-8 !px-2 text-red-400" disabled={deletingId === product.id} onClick={() => removeDraft(product)} type="button" aria-label={`Remove ${product.title} draft`}>
                              {deletingId === product.id ? <LoaderCircle className="animate-spin" size={12} /> : <Trash2 size={12} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editor && (
        <EditorDialog label={editor.mode === "create" ? "Create add-on" : "Edit add-on"} onClose={() => setEditor(null)} busy={submitting}>
          <form key={`${editor.mode}-${editingProduct?.id ?? "new"}`} className="scrollbar-thin max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-line bg-panel shadow-2xl" onSubmit={saveProduct}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="text-sm font-bold">{editor.mode === "create" ? "Publish a new add-on" : `Edit ${editingProduct?.title}`}</p>
                <p className="mt-1 text-sm text-zinc-400">Complete the details below. Required fields are marked *.</p>
              </div>
              <button aria-label="Close add-on editor" className="button-ghost !min-h-11 !px-2.5" disabled={submitting} onClick={() => setEditor(null)} type="button"><X size={17} /></button>
            </div>
            <div className="grid gap-5 p-5">
              {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
              <div><h2 className="text-lg font-bold">1. Add-on details</h2><p className="mt-1 text-sm text-zinc-400">The name, pricing, and compatibility customers see.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Title *</span><input className="field" name="title" required maxLength={120} defaultValue={editingProduct?.title} /></label>
                <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">URL slug *</span><input className="field" name="slug" placeholder="my-addon" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={editingProduct?.slug} /></label>
                <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Category *</span><input className="field" name="category" required maxLength={60} defaultValue={editingProduct?.category} /></label>
                <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Short tagline (optional)</span><input className="field" name="eyebrow" maxLength={160} defaultValue={editingProduct?.eyebrow} /></label>
                <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Pricing</span><select className="field" name="pricing" value={editorPricing} onChange={(event) => setEditorPricing(event.target.value as "free" | "paid")}><option value="free">Free</option><option value="paid">Paid - Stripe</option></select></label>
                <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">USD price (paid add-ons only)</span><input className="field" name="usdPrice" disabled={editorPricing === "free"} required={editorPricing === "paid"} type="number" min="0.50" max="1000000" step="0.01" defaultValue={editingProduct && !editingProduct.isFree ? (editingProduct.usdAmountCents / 100).toFixed(2) : ""} placeholder="9.99" /></label>
                <label className="sm:col-span-2 rounded-lg border border-line bg-ink/45 p-4">
                  <span className="flex items-start gap-3">
                    <input className="mt-0.5" name="requiresLogin" type="checkbox" defaultChecked={editingProduct?.requiresLogin ?? true} disabled={editorPricing === "paid"} />
                    <span>
                      <b className="block text-xs text-zinc-300">Require login before download</b>
                      <small className="mt-1 block text-[0.62rem] leading-5 text-zinc-600">
                        {editorPricing === "paid" ? "Required for paid add-ons to protect purchases and user access." : "Turn this off to allow direct downloads without an account."}
                      </small>
                    </span>
                  </span>
                </label>
                {editor.mode === "create" && (
                  <>
                    <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Initial version *</span><input className="field" name="version" placeholder="1.0.0" required pattern="\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?" /></label>
                    <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Supported Blender versions *</span><input className="field" name="blenderVersions" placeholder="4.2, 4.3, 4.4" required /></label>
                  </>
                )}
                {editor.mode === "edit" && (
                  <label className="sm:col-span-2"><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Supported Blender versions *</span><input className="field" name="blenderVersions" required defaultValue={editingProduct?.blenderVersions.join(", ")} /></label>
                )}
              </div>
              <div className="border-t border-line pt-5"><h2 className="text-lg font-bold">2. Description and instructions</h2><p className="mt-1 text-sm text-zinc-400">Explain what the add-on does and how to install it.</p></div>
              <label><span className="mb-2 block text-sm font-semibold text-zinc-300">Short description *</span><textarea className="field min-h-20 resize-y" name="description" required minLength={10} maxLength={500} defaultValue={editingProduct?.description} /></label>
              <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Full description *</span><textarea className="field min-h-28 resize-y" name="longDescription" required minLength={10} maxLength={5000} defaultValue={editingProduct?.longDescription} /></label>
              <label><span className="mb-2 flex items-center justify-between text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500"><span>Key features *</span><span>One per line</span></span><textarea className="field min-h-28 resize-y" name="features" required defaultValue={editingProduct?.features.join("\n")} /></label>
              <label><span className="mb-2 flex items-center justify-between text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500"><span>Installation and usage guide *</span><span>Markdown</span></span><textarea className="field min-h-40 resize-y font-mono text-xs leading-5" name="guide" required minLength={10} defaultValue={editingProduct?.guide} /></label>
              {editor.mode === "create" && (
                <label><span className="mb-2 flex items-center justify-between text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500"><span>Initial version changelog *</span><span>Markdown</span></span><textarea className="field min-h-28 resize-y font-mono text-xs leading-5" name="changelog" required minLength={3} /></label>
              )}

              <div className="border-t border-line pt-5"><h2 className="text-lg font-bold">3. Files and media</h2><p className="mt-1 text-sm text-zinc-400">Upload the add-on ZIP. Images and a tutorial help customers get started.</p></div>
              <div className="rounded-xl border border-line bg-ink/45 p-4">
                <div className="flex items-center gap-2"><Video className="text-forge" size={16} /><p className="text-xs font-bold">Tutorial and gallery video</p></div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">YouTube or external URL</span><span className="relative block"><Link2 className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} /><input className="field !pl-9" name="tutorialUrl" type="url" defaultValue={editingProduct?.tutorialUrl} placeholder="https://youtube.com/watch?v=..." /></span></label>
                  <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Link label</span><input className="field" name="tutorialLabel" defaultValue={editingProduct?.tutorialLabel} placeholder="Watch on YouTube" /></label>
                </div>
                <label className="mt-4 grid min-h-28 cursor-pointer place-items-center rounded-lg border border-dashed border-line p-4 text-center text-zinc-600 hover:border-forge/40 hover:text-forge">
                  <span><Video className="mx-auto" size={21} /><b className="mt-2 block text-xs">{editingProduct?.tutorialVideoPath ? "Replace gallery video" : "Optional gallery video"}</b><small className="mt-1 block text-[0.58rem] font-normal">MP4 or WEBM · up to 500 MB</small></span>
                  <input className="mt-3 block w-full max-w-full text-xs text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200" name="tutorialVideo" type="file" accept="video/mp4,video/webm,.mp4,.webm" />
                </label>
                {editingProduct?.tutorialVideoPath && <label className="mt-3 flex items-center gap-2 text-[0.66rem] text-zinc-500"><input name="removeTutorialVideo" type="checkbox" /> Remove current uploaded tutorial</label>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid min-h-32 cursor-pointer place-items-center rounded-lg border border-dashed border-line bg-ink p-4 text-center text-zinc-600 hover:border-forge/40 hover:text-forge">
                  <span><ImagePlus className="mx-auto" size={22} /><b className="mt-2 block text-xs">Add gallery images</b><small className="mt-1 block text-[0.58rem] font-normal">Up to 20 JPG, PNG, or WEBP images · 10 MB each</small></span>
                  <input className="mt-3 block w-full max-w-full text-xs text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200" multiple name="images" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" />
                </label>
                {editor.mode === "create" ? (
                  <label className="grid min-h-32 cursor-pointer place-items-center rounded-lg border border-dashed border-forge/30 bg-forge/[0.03] p-4 text-center text-zinc-500 hover:border-forge/60 hover:text-forge">
                    <span><FileArchive className="mx-auto" size={22} /><b className="mt-2 block text-xs">Add-on ZIP *</b><small className="mt-1 block text-[0.58rem] font-normal">Up to 250 MB</small></span>
                    <input className="mt-3 block w-full max-w-full text-xs text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200" name="archive" type="file" accept=".zip,application/zip,application/x-zip-compressed" required />
                  </label>
                ) : (
                  <div className="grid min-h-32 place-items-center rounded-lg border border-line bg-ink p-4 text-center">
                    <div><PackagePlus className="mx-auto text-zinc-600" size={22} /><b className="mt-2 block text-xs text-zinc-500">Use Add version for ZIP releases</b></div>
                  </div>
                )}
              </div>
              {editingProduct && editingProduct.mediaPaths.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">
                    <span>Current gallery</span>
                    <span>{editingProduct.mediaPaths.length}/20 images</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {editingProduct.mediaPaths.map((path, index) => (
                      <label className="group relative overflow-hidden rounded-lg border border-line bg-black" key={path}>
                        <img
                          alt={`${editingProduct.title} gallery image ${index + 1}`}
                          className="aspect-video w-full object-cover"
                          src={publicMediaUrl(path)}
                        />
                        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-black/80 px-2 py-1.5 text-[0.58rem] text-zinc-300">
                          <input name="removeMediaPath" type="checkbox" value={path} />
                          Remove
                        </span>
                        {index === 0 && (
                          <span className="absolute left-1.5 top-1.5 rounded bg-forge px-1.5 py-0.5 text-[0.5rem] font-black uppercase text-black">
                            Main
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-md border border-forge/15 bg-forge/[0.04] px-4 py-3 text-[0.66rem] leading-5 text-zinc-500">
                Paid prices create a one-time USD Product and Price in the connected Stripe test or live account. Price changes create a new Stripe Price and archive the previous one.
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-panel/95 px-5 py-4">
              <button className="button-secondary" disabled={submitting} onClick={() => setEditor(null)} type="button">Cancel</button>
              <button className="button-primary" disabled={submitting} type="submit">
                {submitting ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}
                {submitting ? "Saving..." : editor.mode === "create" ? "Upload and publish" : "Save changes"}
              </button>
            </div>
          </form>
        </EditorDialog>
      )}

      {versionEditor && (
        <EditorDialog label={`Add version to ${versionEditor.title}`} onClose={() => setVersionEditor(null)} busy={submitting}>
          <form className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-xl border border-line bg-panel shadow-2xl" onSubmit={addVersion}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div><p className="text-sm font-bold">Add version to {versionEditor.title}</p><p className="mt-1 text-[0.6rem] text-zinc-600">The new ZIP becomes available to existing owners</p></div>
              <button aria-label="Close version editor" className="button-ghost !min-h-11 !px-2.5" disabled={submitting} onClick={() => setVersionEditor(null)} type="button"><X size={17} /></button>
            </div>
            <div className="grid gap-5 p-5">
              {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
              <label><span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Version *</span><input className="field" name="version" placeholder="1.1.0" required pattern="\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?" /></label>
              <label><span className="mb-2 flex items-center justify-between text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500"><span>Changelog *</span><span>Markdown</span></span><textarea className="field min-h-32 resize-y font-mono text-xs leading-5" name="changelog" required minLength={3} /></label>
              <label className="grid min-h-36 cursor-pointer place-items-center rounded-lg border border-dashed border-forge/30 bg-forge/[0.03] p-4 text-center text-zinc-500 hover:border-forge/60 hover:text-forge">
                <span><FileArchive className="mx-auto" size={22} /><b className="mt-2 block text-xs">New add-on ZIP *</b><small className="mt-1 block text-[0.58rem] font-normal">Up to 250 MB</small></span>
                <input className="mt-3 block w-full max-w-full text-xs text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200" name="archive" type="file" accept=".zip,application/zip,application/x-zip-compressed" required />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
              <button className="button-secondary" disabled={submitting} onClick={() => setVersionEditor(null)} type="button">Cancel</button>
              <button className="button-primary" disabled={submitting} type="submit">{submitting ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}{submitting ? "Uploading..." : "Upload and publish version"}</button>
            </div>
          </form>
        </EditorDialog>
      )}
    </>
  );
}
