import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ReactWebChat, { createDirectLine, createStyleSet} from 'botframework-webchat';
import { v4 as uuid } from 'uuid';
import './WebChat.css';
const userID = `agent_${ uuid()}`;

const WebChat = () => {
    const [token, setToken] = useState();
    const directLine = useMemo(() => createDirectLine({ token }), [token]);

    const styleSet = useMemo(
        () =>
          createStyleSet({
            avatarSize: 40,
            bubbleFromUserBackground: 'rgba(102, 178, 255, 1)',
            bubbleFromUserTextColor: 'rgba(255, 255, 255, 1)',
            bubbleBorderRadius: 10,
            bubbleromUserBorderRadius: 10,
            groupTimestamp: 3000,
            transcriptOverlayButtonColorOnHover: 'rgba(6, 57, 112, 1)',
            transcriptOverlayButtonColor: 'red'
          }),
        []
    );

    const styleOptions = useMemo(
        () => {return {
            botAvatarInitials: 'U',
            userAvatarInitials: 'A',
            userAvatarImage: 'https://cdn-icons-png.flaticon.com/512/4298/4298373.png',
            botAvatarImage: 'https://cdn-icons-png.flaticon.com/512/1077/1077012.png',
        }} ,[]
    );

    const handleFetchToken = useCallback(async () => {
  
      if (!token) {
        const res = await fetch('https://directline.botframework.com/v3/directline/tokens/generate', 
        { 
          method: 'POST',
          headers: {
            'Authorization': `Bearer MEnCXMga-RQ.vQljb74sWLBkgQ_QeMrcCe89uLcNLExpVppOmcj49g4`,
            'Content-Type': 'application/json'
          }
        });
        const { token } = await res.json();
        setToken(token);
      }
    }, [setToken, token]);

    useEffect(() => { 
        handleFetchToken();
    });

    return token ? (<ReactWebChat className="react-web-chat"
                                  userID={userID}
                                  directLine={directLine}
                                  styleSet={styleSet}
                                  styleOptions={styleOptions} />) :
                   (<div><p> Please wait while we are connecting. </p></div>);
};

export default WebChat;