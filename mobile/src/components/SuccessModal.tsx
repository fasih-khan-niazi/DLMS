import React from "react";
import { AppModal } from "./AppModal";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

// purana success modal - AppModal prefer karo
export function SuccessModal({ visible, title, message, onClose }: Props) {
  return (
    <AppModal
      visible={visible}
      variant="success"
      title={title}
      message={message}
      confirmLabel="Done"
      onClose={onClose}
    />
  );
}
