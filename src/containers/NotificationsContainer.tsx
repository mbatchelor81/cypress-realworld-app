import React, { useCallback, useEffect, useRef } from "react";
import { styled } from "@mui/material/styles";
import {
  BaseActionObject,
  Interpreter,
  ResolveTypegenMeta,
  ServiceMap,
  TypegenDisabled,
} from "xstate";
import { useActor } from "@xstate/react";
import { Paper, Typography } from "@mui/material";
import { NotificationUpdatePayload } from "../models";
import NotificationList from "../components/NotificationList";
import { DataContext, DataSchema, DataEvents } from "../machines/dataMachine";
import { AuthMachineContext, AuthMachineEvents, AuthMachineSchema } from "../machines/authMachine";
import { NotificationSocketMessage, useNotificationSocket } from "../utils/notificationSocket";

const NOTIFICATIONS_POLL_INTERVAL_MS = 10_000;

const PREFIX = "NotificationsContainer";

const classes = {
  paper: `${PREFIX}-paper`,
};

const StyledPaper = styled(Paper)(({ theme }) => ({
  [`&.${classes.paper}`]: {
    minHeight: "90vh",
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
  },
}));

export interface Props {
  authService: Interpreter<AuthMachineContext, AuthMachineSchema, AuthMachineEvents, any, any>;
  notificationsService: Interpreter<
    DataContext,
    DataSchema,
    DataEvents,
    any,
    ResolveTypegenMeta<TypegenDisabled, DataEvents, BaseActionObject, ServiceMap>
  >;
}

const NotificationsContainer: React.FC<Props> = ({ authService, notificationsService }) => {
  const [authState] = useActor(authService);
  const [notificationsState, sendNotifications] = useActor(notificationsService);

  const isAuthorized = authState.matches("authorized");

  useEffect(() => {
    sendNotifications({ type: "FETCH" });
  }, [authState, sendNotifications]);

  const handleSocketMessage = useCallback(
    (msg: NotificationSocketMessage) => {
      if (msg.type === "notification.created" || msg.type === "notification.updated") {
        sendNotifications({ type: "FETCH" });
      }
    },
    [sendNotifications]
  );

  const socketStatus = useNotificationSocket({
    enabled: isAuthorized,
    onMessage: handleSocketMessage,
  });

  // Polling fallback: only poll while the WebSocket is not open.
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (!isAuthorized) return;
    if (socketStatus === "open") return;

    pollTimerRef.current = setInterval(() => {
      sendNotifications({ type: "FETCH" });
    }, NOTIFICATIONS_POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isAuthorized, socketStatus, sendNotifications]);

  const updateNotification = (payload: NotificationUpdatePayload) =>
    sendNotifications({ type: "UPDATE", ...payload });

  return (
    <StyledPaper className={classes.paper}>
      <Typography component="h2" variant="h6" color="primary" gutterBottom>
        Notifications
      </Typography>
      <NotificationList
        notifications={notificationsState?.context?.results!}
        updateNotification={updateNotification}
      />
    </StyledPaper>
  );
};

export default NotificationsContainer;
