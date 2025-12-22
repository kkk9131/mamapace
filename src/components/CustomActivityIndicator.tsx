import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface CustomActivityIndicatorProps {
    size?: number;
    color?: string;
}

export default function CustomActivityIndicator({
    size = 24,
    color,
}: CustomActivityIndicatorProps) {
    const rotation = useRef(new Animated.Value(0)).current;
    const { colors } = useTheme();
    const indicatorColor = color || colors.pink;

    useEffect(() => {
        Animated.loop(
            Animated.timing(rotation, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
                easing: t => t, // Linear
            })
        ).start();
    }, [rotation]);

    const rotate = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View
            style={{
                width: size,
                height: size,
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <Animated.View
                style={{
                    width: size,
                    height: size,
                    borderWidth: 3,
                    borderColor: indicatorColor,
                    borderTopColor: 'transparent',
                    borderRadius: size / 2,
                    transform: [{ rotate }],
                }}
            />
        </View>
    );
}
