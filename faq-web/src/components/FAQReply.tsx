export interface FAQReplyData {
  id: string;
  faqId: string;
  authorStudentId: string;
  body: string;
  likes: number;
  likedBy: string[];
}

import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQReplyComponentProps {
  reply: FAQReplyData;
  viewerStudentId?: string | null;
  onLike: (replyId: string, liked: boolean) => void;
}

export default function FAQReplyComponent({
  reply,
  viewerStudentId,
  onLike,
}: FAQReplyComponentProps) {
  const isLiked = viewerStudentId ? reply.likedBy.includes(viewerStudentId) : false;
  const [optimisticLiked, setOptimisticLiked] = useState(isLiked);
  const [optimisticLikes, setOptimisticLikes] = useState(reply.likes);

  const handleLike = () => {
    const newLiked = !optimisticLiked;
    setOptimisticLiked(newLiked);
    setOptimisticLikes((prev) => (newLiked ? prev + 1 : prev - 1));
    onLike(reply.id, newLiked);
  };

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-muted/50">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground break-words">{reply.body}</p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1 text-xs transition-colors",
              optimisticLiked
                ? "text-accent"
                : "text-muted hover:text-foreground"
            )}
          >
            <ThumbsUp className="w-3 h-3" />
            <span>{optimisticLikes}</span>
          </button>
        </div>
      </div>
    </div>
  );
}