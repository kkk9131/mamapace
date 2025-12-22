import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

interface AnimatedScreenWrapperProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    type?: 'fade' | 'slide' | 'none';
}

export default function AnimatedScreenWrapper({
    children,
    style,
    type = 'fade',
}: AnimatedScreenWrapperProps) {
    const animValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Reset animation on mount
        animValue.setValue(0);

        Animated.timing(animValue, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
            // Ease out cubic
            easing: (t) => 1 - Math.pow(1 - t, 3),
        }).start();
    }, [animValue]);

    if (type === 'none') {
        return <>{children}</>;
    }

    const animatedStyle =
        type === 'slide'
            ? {
                opacity: animValue,
                transform: [
                    {
                        translateX: animValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [20, 0],
                        }),
                    },
                ],
            }
            : {
                opacity: animValue,
            };

    return (
        <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>
            {children}
        </Animated.View>
    );
}
