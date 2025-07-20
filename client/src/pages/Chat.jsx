import {
  Box,
  Heading,
  Input,
  Button,
  VStack,
  Text,
  HStack,
  useToast,
  Spinner,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  useDisclosure,
  Spacer,
} from "@chakra-ui/react";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { FaTools } from "react-icons/fa";
import { RiAiGenerateText } from "react-icons/ri";
import TemplateForm from "../components/TemplateForm";
import EmailForm from "../components/EmailForm";
import ClearChatButton from "../components/ClearChatButton";
import { MdOutlineMarkEmailRead, MdAttachFile } from "react-icons/md";

function Chat() {
  const { agentId } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [agent, setAgent] = useState(null);
  const [agentTools, setAgentTools] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const [showWhatsappButton, setShowWhatsappButton] = useState(false);

  // Email modal state
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const [isClearing, setIsClearing] = useState(false);

  const token = localStorage.getItem("access_token");
  const currentUserRole = localStorage.getItem("role");

  // Fetch agent details and chat history
  useEffect(() => {
    if (!token || !agentId) {
      toast({
        title: "Unauthorized",
        description: "You must be logged in to chat.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      navigate("/"); // redirect to login
      return;
    }

    async function fetchData() {
      setInitialLoading(true);
      try {
        // Fetch agent
        const agentRes = await fetch(
          `${import.meta.env.VITE_API_URL}/agents/${agentId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!agentRes.ok) throw new Error("Unauthorized to access agent");

        const agentData = await agentRes.json();
        setAgent(agentData);
        setAgentTools(agentData.tools || []);

        // Fetch chat history
        const chatRes = await fetch(`${import.meta.env.VITE_API_URL}/chat/${agentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const chatData = await chatRes.json();
        setMessages(chatData.chat_history || []);
      } catch (err) {
        toast({
          title: "Access denied",
          description: "You may not be authorized to view this chat.",
          status: "error",
          duration: 4000,
          isClosable: true,
        });
        navigate("/home");
      } finally {
        setInitialLoading(false);
      }
    }

    fetchData();
  }, [agentId]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setEmailFrom(data.email);
        }
      } catch (err) {
        console.error("Failed to fetch user email");
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage.role === "assistant" &&
      lastMessage.content.includes(
        "Sorry, I can't provide a valid answer for that question. Would you like to chat with a live agent?"
      )
    ) {
      setShowWhatsappButton(true);
    } else {
      setShowWhatsappButton(false);
    }
  }, [messages]);

  // Scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agent_id: agentId,
          message: input,
          chat_history: messages,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(data.chat_history || []);
      } else {
        throw new Error("Failed to chat");
      }
    } catch (err) {
      toast({
        title: "Chat failed",
        description: "Unable to send message.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Error: I couldn't process that. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e, closePopover) => {
    if (closePopover) closePopover();

    const selectedFiles = Array.from(e.target.files);
    const formData = new FormData();

    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/chat/${agentId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();

      const uploadedFilenames =
        data.uploadedFiles || selectedFiles.map((f) => f.name);
      const uploadedMsg = `Uploaded: 📄 ${uploadedFilenames.join(", ")}`;

      // ✅ Add system message to chat
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: uploadedMsg,
        },
      ]);

      toast({ title: "Documents uploaded successfully", status: "success" });
    } catch (err) {
      toast({ title: "Upload failed", status: "error" });
    }
  };

  const handleLetterGenerated = async (letterData) => {
    if (letterData.type === "docx") {
      const assistantMessage = {
        role: "assistant",
        content: `📄 Letter generated and downloaded.`,
        fileUrl: letterData.url,
        fileType: "docx",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } else {
      const assistantMessage = {
        role: "assistant",
        content: letterData.content,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }
  };

  const clearChat = async () => {
    setIsClearing(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/agents/${agentId}/clear-chat`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to clear chat");

      // Clear frontend chat state after backend clears chat history
      setMessages([]);
    } catch (err) {
      toast({
        title: "Failed to clear chat",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsClearing(false);
    }
  };

  if (initialLoading) {
    return (
      <Box p={8} textAlign="center">
        <Spinner size="xl" />
        <Text mt={2}>Loading agent...</Text>
      </Box>
    );
  }

  return (
    <VStack minHeight="100vh" spacing={8} p={5} background="#3182ce">
      <Box w="80%" p={8}>
        <Box background="white" p="10" borderRadius="10">
          <Box color="white" background="#3182ce" p="15" borderTopRadius={15}>
            <HStack>
              <Box>
                <Heading color="white" mb={2}>
                  Chat with {agent.name}
                </Heading>
                <Text mb={2} color="white.300">
                  {agent?.description}
                </Text>
              </Box>
              <Spacer />
              <ClearChatButton onClear={clearChat} isLoading={isClearing} />
            </HStack>
          </Box>

          <Box background="#f8f9f9ff" p="15">
            <VStack
              spacing={4}
              align="stretch"
              maxH="60vh"
              overflowY="auto"
              mb={4}
            >
              {messages.length === 0 && (
                <Box p={3} bg="blue.100" borderRadius="md">
                  <Text>
                    👋 Hello! I'm {agent?.name || "your AI agent"}. How can I
                    help you today?
                  </Text>
                </Box>
              )}
              {messages.map((msg, idx) => (
                <Box
                  key={idx}
                  p={3}
                  borderRadius="md"
                  bg={msg.role === "user" ? "gray.100" : "blue.100"}
                >
                  <Text whiteSpace="pre-line">
                    <strong>
                      {msg.role === "user" ? "You" : agent?.name || "Agent"}:
                    </strong>
                    {"\n"}
                    {
                      msg.content
                        .replace(/\*\*/g, "") // Remove all **
                        .replace(/(\d+)\.\s*/g, "\n$1. ") // Add newline before numbered list items
                    }
                  </Text>
                </Box>
              ))}
              <div ref={messagesEndRef} />
            </VStack>

            {/* WhatsApp Button for live agent */}
            {showWhatsappButton && (
              <Button
                as="a"
                href="https://wa.me/94771234567?text=Hi,%20I%20need%20some%20help%20regarding%20LEARN.%20Could%20you%20assist%20me%3F"
                target="_blank"
                rel="noopener noreferrer"
                colorScheme="whatsapp"
                leftIcon={
                  <img
                    src="/whatsapp.svg"
                    alt="WhatsApp"
                    width="20"
                    height="20"
                  />
                }
                mt={1}
                size="md"
                color="black"
              >
                Contact Live Agent on WhatsApp
              </Button>
            )}
          </Box>

          <HStack spacing={2}>
            <Popover placement="top-start">
              <PopoverTrigger>
                <IconButton
                  icon={<FaTools />}
                  aria-label="Options"
                  variant="outline"
                />
              </PopoverTrigger>
              <PopoverContent width="fit-content">
                <PopoverBody>
                  <VStack align="start" spacing={2}>
                    {agentTools.includes("file_reader") && (
                      <Button
                        leftIcon={<MdAttachFile />}
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          document.getElementById("fileInput").click()
                        }
                      >
                        Attach Files
                      </Button>
                    )}

                    {agentTools.includes("template_generator") &&
                      currentUserRole !== "customer" && (
                        <Button
                          leftIcon={<RiAiGenerateText />}
                          size="sm"
                          variant="ghost"
                          onClick={onOpen}
                        >
                          Generate Templates
                        </Button>
                      )}

                    {agentTools.includes("email_sender") && (
                      <Button
                        leftIcon={<MdOutlineMarkEmailRead />}
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEmailOpen(true)}
                        aria-label="Email Box"
                      >
                        Send Email
                      </Button>
                    )}
                  </VStack>
                </PopoverBody>
              </PopoverContent>
            </Popover>
            <input
              id="fileInput"
              type="file"
              accept="application/pdf"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleFileUpload(e, onClose)}
            />
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) sendMessage();
              }}
              isDisabled={loading}
            />
            <Button
              onClick={sendMessage}
              colorScheme="blue"
              isLoading={loading}
              isDisabled={!input.trim() || loading}
            >
              Send
            </Button>
          </HStack>
        </Box>
      </Box>

      {/* Modal for letter form */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Templates</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <TemplateForm
              onClose={onClose}
              onLetterGenerated={handleLetterGenerated}
              userRole={currentUserRole}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Email Modal */}
      <EmailForm
        isOpen={isEmailOpen}
        onClose={() => setIsEmailOpen(false)}
        token={token}
        setMessages={setMessages}
      />
    </VStack>
  );
}

export default Chat;
