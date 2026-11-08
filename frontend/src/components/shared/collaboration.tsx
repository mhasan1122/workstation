"use client";

import { FileText, Loader2, MessageSquare, Paperclip, Send, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api, assetUrl, getErrorMessage, pictureUrl } from "@/lib/api";
import { formatDateTime, initials, timeAgo } from "@/lib/utils";
import type { Attachment, Comment } from "@/types";
import { EmptyState } from "./states";

export function CommentsPanel({
  basePath,
  comments,
  disabled,
  onChange,
}: {
  basePath: string;
  comments: Comment[];
  disabled?: boolean;
  onChange: () => void | Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    setSending(true);
    try {
      await api.post(`${basePath}/comments`, { content: text });
      setContent("");
      await onChange();
      toast.success("Comment added");
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not add comment"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex min-w-0 items-center gap-2">
          <MessageSquare className="size-4 shrink-0 text-gold-dark" />
          Comments
          <span className="rounded-full bg-muted px-2 py-0.5 font-sans text-xs font-semibold text-ink-muted">
            {comments.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {comments.length === 0 ? (
          <EmptyState compact icon={MessageSquare} title="No comments yet" description="Start the conversation below." />
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar className="size-8">
                  {c.user?.profile_picture && (
                    <AvatarImage src={pictureUrl(c.user.profile_picture)} alt="" />
                  )}
                  <AvatarFallback className="text-[11px]">{initials(c.user?.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs">
                    <span className="font-semibold text-navy">{c.user?.full_name ?? "Unknown"}</span>
                    {c.user?.role === "admin" && (
                      <span className="rounded bg-gold-soft px-1.5 py-px text-[10px] font-bold tracking-wide text-gold-dark uppercase">
                        Admin
                      </span>
                    )}
                    <span className="text-ink-muted" title={formatDateTime(c.created_at)}>
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{c.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!disabled && (
          <form onSubmit={submit} className="space-y-2.5">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a comment…"
              maxLength={5000}
              className="min-h-[76px]"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={sending} disabled={!content.trim()}>
                <Send />
                Post comment
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function AttachmentsPanel({
  basePath,
  attachments,
  disabled,
  onChange,
}: {
  basePath: string;
  attachments: Attachment[];
  disabled?: boolean;
  onChange: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try {
        await api.post(`${basePath}/attachments`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        ok++;
      } catch (err) {
        toast.error(`${file.name}: ${getErrorMessage(err, "Upload failed")}`);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
    if (ok > 0) {
      toast.success(ok === 1 ? "File uploaded" : `${ok} files uploaded`);
      await onChange();
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex min-w-0 flex-wrap items-center gap-2">
          <Paperclip className="size-4 shrink-0 text-gold-dark" />
          Attachments
          <span className="rounded-full bg-muted px-2 py-0.5 font-sans text-xs font-semibold text-ink-muted">
            {attachments.length}
          </span>
        </CardTitle>
        {!disabled && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <EmptyState compact icon={Paperclip} title="No attachments" description="Upload files to share supporting material." />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={assetUrl(a.url ?? `/uploads/${a.file_path}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-accent"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">{a.filename}</p>
                    <p className="text-xs text-ink-muted">{formatDateTime(a.created_at)}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
