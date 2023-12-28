import {
  Add,
  AddCircle,
  Remove,
  RemoveCircle,
  Edit,
  Female,
  Male,
  ChevronLeft,
  ChevronRight,
  Delete,
  MoreVert,
  Close,
} from "@mui/icons-material";
import Icon, { type IconProps } from "@mui/material/Icon";

export enum BabyCareEmoji {
  HOME = "🏠",
  BABY = "👶",
  BOTTLE = "🍼",
  BREAST_PUMP = "⛽️",
  NURSING = "🤱",
  CHILD_TOY = "🧸",
  SLEEP = "😴",
  BATH = "🛁",
  SNACK = "🍿",
  PEE = "💦",
  POOP = "💩",
}

export const NursingIcon = (props: IconProps) => (
  <Icon {...props}>{BabyCareEmoji.NURSING}</Icon>
);
export const HomeIcon = (props: IconProps) => (
  <Icon {...props}>{BabyCareEmoji.HOME}</Icon>
);
export const ChildToyIcon = (props: IconProps) => (
  <Icon {...props}>{BabyCareEmoji.CHILD_TOY}</Icon>
);
export const BabyIcon = (props: IconProps) => (
  <Icon {...props}>{BabyCareEmoji.BABY}</Icon>
);
export const SleepIcon = (props: IconProps) => (
  <Icon {...props}>{BabyCareEmoji.SLEEP}</Icon>
);
export const PoopIcon = (props: IconProps) => (
  <Icon {...props}>{BabyCareEmoji.POOP}</Icon>
);
export const PeeIcon = (props: IconProps) => (
  <Icon {...props}>{BabyCareEmoji.PEE}</Icon>
);
export const BathIcon = (props: IconProps) => (
  <Icon {...props}>{BabyCareEmoji.BATH}</Icon>
);
export const BottleIcon = (props: IconProps) => (
  <Icon {...props}>{BabyCareEmoji.BOTTLE}</Icon>
);
export const SnackIcon = (props: IconProps) => (
  <Icon {...props}>{BabyCareEmoji.SNACK}</Icon>
);
export const BreastPumpIcon = (props: IconProps) => (
  <Icon {...props}>{BabyCareEmoji.BREAST_PUMP}</Icon>
);
export const AddIcon = Add;
export const AddCircleIcon = AddCircle;
export const RemoveIcon = Remove;
export const RemoveCircleIcon = RemoveCircle;
export const DeleteIcon = Delete;
export const EditIcon = Edit;
export const MaleIcon = Male;
export const FemaleIcon = Female;
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRightIcon = ChevronRight;
export const MoreVertIcon = MoreVert;
export const CloseIcon = Close;
