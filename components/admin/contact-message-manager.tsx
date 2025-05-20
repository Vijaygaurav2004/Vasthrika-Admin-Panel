// components/admin/contact-message-manager.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Mail, X, Check, ExternalLink, MailOpen } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

// Define the Contact Message interface
interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
  reply_status: "not_replied" | "replied";
  reply_text?: string;
  reply_at?: string;
}

export default function ContactMessageManager() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  useEffect(() => {
    loadMessages();
  }, [filter]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      
      if (!supabase) throw new Error("Supabase client not initialized");
      
      let query = supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      
      // Apply filter
      if (filter === "unread") {
        query = query.eq("is_read", false);
      } else if (filter === "read") {
        query = query.eq("is_read", true);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
      toast({
        title: "Error",
        description: "Failed to load contact messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (message: ContactMessage) => {
    try {
      if (!supabase) throw new Error("Supabase client not initialized");
      
      const { error } = await supabase
        .from("contact_messages")
        .update({ is_read: true })
        .eq("id", message.id);
      
      if (error) throw error;
      
      // Update local state
      setMessages(messages.map(m => 
        m.id === message.id ? { ...m, is_read: true } : m
      ));
      
      // Update selected message if it's the one being marked as read
      if (selectedMessage && selectedMessage.id === message.id) {
        setSelectedMessage({ ...selectedMessage, is_read: true });
      }
      
      toast({
        title: "Success",
        description: "Message marked as read",
      });
    } catch (error) {
      console.error("Error marking message as read:", error);
      toast({
        title: "Error",
        description: "Failed to mark message as read",
        variant: "destructive",
      });
    }
  };

  const openMessageDetails = (message: ContactMessage) => {
    setSelectedMessage(message);
    
    // If the message is unread, mark it as read
    if (!message.is_read) {
      markAsRead(message);
    }
  };

  const closeMessageDetails = () => {
    setSelectedMessage(null);
  };

  const openReplyDialog = () => {
    setReplyOpen(true);
    setReplyText(selectedMessage?.reply_text || "");
  };

  const closeReplyDialog = () => {
    setReplyOpen(false);
    setReplyText("");
  };

  const handleReply = async () => {
    try {
      if (!selectedMessage) return;
      if (!supabase) throw new Error("Supabase client not initialized");
      
      // In a real application, you would actually send an email here
      // For this example, we'll just update the database
      
      const { error } = await supabase
        .from("contact_messages")
        .update({
          reply_status: "replied",
          reply_text: replyText,
          reply_at: new Date().toISOString(),
        })
        .eq("id", selectedMessage.id);
      
      if (error) throw error;
      
      // Update local state
      const updatedMessage = {
        ...selectedMessage,
        reply_status: "replied" as const,
        reply_text: replyText,
        reply_at: new Date().toISOString(),
      };
      
      setMessages(messages.map(m => 
        m.id === selectedMessage.id ? updatedMessage : m
      ));
      
      setSelectedMessage(updatedMessage);
      
      toast({
        title: "Success",
        description: "Reply sent successfully",
      });
      
      closeReplyDialog();
    } catch (error) {
      console.error("Error sending reply:", error);
      toast({
        title: "Error",
        description: "Failed to send reply",
        variant: "destructive",
      });
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (confirm("Are you sure you want to delete this message? This action cannot be undone.")) {
      try {
        if (!supabase) throw new Error("Supabase client not initialized");
        
        const { error } = await supabase
          .from("contact_messages")
          .delete()
          .eq("id", messageId);
        
        if (error) throw error;
        
        // Update local state
        setMessages(messages.filter(m => m.id !== messageId));
        
        // Close the details dialog if the deleted message was selected
        if (selectedMessage && selectedMessage.id === messageId) {
          closeMessageDetails();
        }
        
        toast({
          title: "Success",
          description: "Message deleted successfully",
        });
      } catch (error) {
        console.error("Error deleting message:", error);
        toast({
          title: "Error",
          description: "Failed to delete message",
          variant: "destructive",
        });
      }
    }
  };

  const filteredMessages = messages.filter(message => {
    // Apply search filter
    const searchTermLower = searchTerm.toLowerCase();
    return (
      message.name.toLowerCase().includes(searchTermLower) ||
      message.email.toLowerCase().includes(searchTermLower) ||
      message.subject.toLowerCase().includes(searchTermLower) ||
      message.message.toLowerCase().includes(searchTermLower)
    );
  });

  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Contact Messages</h2>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            onClick={() => setFilter("unread")}
          >
            Unread
          </Button>
          <Button
            variant={filter === "read" ? "default" : "outline"}
            onClick={() => setFilter("read")}
          >
            Read
          </Button>
        </div>
      </div>
      
      <div className="flex mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <p>Loading messages...</p>
          </div>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No messages found</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Reply Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMessages.map((message) => (
              <TableRow 
                key={message.id}
                className={message.is_read ? "" : "bg-primary/5"}
              >
                <TableCell>
                  {message.is_read ? (
                    <MailOpen className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Mail className="h-5 w-5 text-primary" />
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{message.name}</div>
                    <div className="text-sm text-muted-foreground">{message.email}</div>
                  </div>
                </TableCell>
                <TableCell>{message.subject}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatTime(message.created_at)}
                </TableCell>
                <TableCell>
                  {message.reply_status === "replied" ? (
                    <Badge className="bg-green-600">Replied</Badge>
                  ) : (
                    <Badge variant="outline">Not Replied</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMessageDetails(message)}
                    >
                      View Details
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMessage(message.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      
      {/* Message Details Dialog */}
      {selectedMessage && (
        <Dialog open={Boolean(selectedMessage)} onOpenChange={closeMessageDetails}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedMessage.subject}</DialogTitle>
              <DialogDescription>
                From {selectedMessage.name} ({selectedMessage.email})
                <span className="block text-xs text-gray-500 mt-1">
                  Received {formatTime(selectedMessage.created_at)}
                </span>
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4 border-t border-b">
              <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
            </div>
            
            {selectedMessage.reply_status === "replied" && selectedMessage.reply_text && (
              <div className="mt-4 p-4 bg-muted rounded-md">
                <h4 className="font-medium mb-2 flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600" />
                  Your Reply {selectedMessage.reply_at && `(${formatTime(selectedMessage.reply_at)})`}
                </h4>
                <p className="text-sm whitespace-pre-wrap">{selectedMessage.reply_text}</p>
              </div>
            )}
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline"
                onClick={closeMessageDetails}
              >
                Close
              </Button>
              
              <Button 
                type="button"
                onClick={openReplyDialog}
                className="gap-2"
              >
                {selectedMessage.reply_status === "replied" ? (
                  <>
                    <Mail className="h-4 w-4" />
                    Update Reply
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Reply
                  </>
                )}
              </Button>
              
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={() => window.open(`mailto:${selectedMessage.email}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Open in Email Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Reply Dialog */}
      <Dialog open={replyOpen} onOpenChange={closeReplyDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Reply to {selectedMessage?.name}
            </DialogTitle>
            <DialogDescription>
              Your reply will be recorded in the system
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2">
            <div className="mb-2">
              <strong>To:</strong> {selectedMessage?.name} ({selectedMessage?.email})
            </div>
            <div className="mb-4">
              <strong>Subject:</strong> Re: {selectedMessage?.subject}
            </div>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your reply here..."
              rows={10}
              className="w-full"
            />
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline"
              onClick={closeReplyDialog}
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleReply}
              disabled={!replyText.trim()}
            >
              Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}