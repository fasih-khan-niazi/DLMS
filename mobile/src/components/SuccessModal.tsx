import React from "react";
import { AppModal } from "./AppModal";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

/** @deprecated Prefer AppModal with variant="success". Kept for older call sites. */
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
