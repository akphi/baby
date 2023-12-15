import { Button, Dialog, DialogActions, DialogContent } from "@mui/material";

export const ConfirmationDialog = (props: {
  open: boolean;
  onClose: () => void;
  action: () => void;
  message: string;
}) => {
  const { open, onClose, action, message } = props;
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent dividers>{message}</DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus color="primary">
          Abort
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            action();
            onClose();
          }}
          color="error"
        >
          Proceed
        </Button>
      </DialogActions>
    </Dialog>
  );
};
